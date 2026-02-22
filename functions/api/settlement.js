export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const groupId = url.searchParams.get('group_id') || 'group_default';
  const EXPENSE_TYPE = '支出';

  try {
    // Execute database queries in parallel
    const [paidResults, members] = await Promise.all([
      // 1. Calculate total paid per person for "Expense"
      env.DB.prepare(`
        SELECT payer_id, SUM(amount) as total_paid
        FROM records
        WHERE group_id = ? AND type = ?
        GROUP BY payer_id
      `).bind(groupId, EXPENSE_TYPE).all(),
      // 2. Get all members of the group
      env.DB.prepare(`SELECT id, name FROM members WHERE group_id = ?`).bind(groupId).all()
    ]);

    if (!members.results || members.results.length === 0) {
      return Response.json({ total: 0, perPerson: 0, balances: [] });
    }

    const memberList = members.results;
    const paidMap = {}; // payer_id -> amount
    let totalGroupSpend = 0;

    if (paidResults.results) {
      paidResults.results.forEach(r => {
        paidMap[r.payer_id] = r.total_paid;
        totalGroupSpend += r.total_paid;
      });
    }

    const perPersonShare = totalGroupSpend / memberList.length;

    // 3. Calculate balances
    // Positive balance = You paid more than share, you receive money.
    // Negative balance = You paid less than share, you owe money.
    let balances = memberList.map(m => {
      const paid = paidMap[m.id] || 0;
      return {
        id: m.id,
        name: m.name,
        paid: paid,
        balance: paid - perPersonShare
      };
    });

    // 4. Generate user-friendly message (Simplified for 2-person case usually)
    // Find who owes money (negative balance) and who receives money (positive balance)
    const debtors = balances.filter(b => b.balance < -0.01);
    const creditors = balances.filter(b => b.balance > 0.01);

    let messages = [];

    // Simple greedy matching for settlement message
    // Note: This is a basic algorithm sufficient for small groups (esp. 2 people)
    let dIndex = 0;
    let cIndex = 0;

    // Clone to avoid mutating the original balances array used in response
    const dList = debtors.map(d => ({ ...d }));
    const cList = creditors.map(c => ({ ...c }));

    while (dIndex < dList.length && cIndex < cList.length) {
      const debtor = dList[dIndex];
      const creditor = cList[cIndex];

      const amountToSettle = Math.min(Math.abs(debtor.balance), creditor.balance);

      messages.push(`${debtor.name} needs to pay ${creditor.name} ${amountToSettle.toFixed(2)}`);

      debtor.balance += amountToSettle;
      creditor.balance -= amountToSettle;

      if (Math.abs(debtor.balance) < 0.01) dIndex++;
      if (creditor.balance < 0.01) cIndex++;
    }

    if (messages.length === 0) {
      messages.push("Settled up!");
    }

    return Response.json({
        total: totalGroupSpend,
        perPerson: perPersonShare,
        balances: balances,
        message: messages.join(", ")
    });

  } catch (err) {
    // If table doesn't exist, return empty data
    if (String(err).includes("no such table")) {
        return Response.json({ total: 0, perPerson: 0, balances: [] });
    }
    return Response.json({ error: err.message }, { status: 500 });
  }
}
