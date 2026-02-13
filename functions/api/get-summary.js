export async function onRequestGet(context) {
  const { env } = context;

  try {
    // 同時查詢支出與儲蓄總額
    const [expenses, savings] = await Promise.all([
      env.DB.prepare(`
        SELECT 
          SUM(CASE WHEN payer_id = 'Daniel' THEN amount ELSE 0 END) as d_paid,
          SUM(CASE WHEN payer_id = 'Jacky' THEN amount ELSE 0 END) as j_paid,
          SUM(daniel_share) as d_debt,
          SUM(jacky_share) as j_debt
        FROM records
      `).first(),
      env.DB.prepare(`
        SELECT 
          SUM(CASE WHEN payer_id = 'Daniel' THEN amount ELSE 0 END) as d_saved,
          SUM(CASE WHEN payer_id = 'Jacky' THEN amount ELSE 0 END) as j_saved,
          SUM(amount) as total_savings
        FROM savings
      `).first()
    ]);

    // 計算支出結餘 (實付 - 應分擔額)
    const dBalance = (expenses?.d_paid || 0) - (expenses?.d_debt || 0);
    const jBalance = (expenses?.j_paid || 0) - (expenses?.j_debt || 0);

    const result = {
      expenses: {
        paid: { Daniel: expenses?.d_paid || 0, Jacky: expenses?.j_paid || 0 },
        should_bear: { Daniel: expenses?.d_debt || 0, Jacky: expenses?.j_debt || 0 },
        balance: { Daniel: dBalance, Jacky: jBalance },
        summary: dBalance > 0 
          ? `Jacky owes Daniel ${dBalance.toFixed(2)}` 
          : `Daniel owes Jacky ${Math.abs(dBalance).toFixed(2)}`
      },
      savings: {
        total: savings?.total_savings || 0,
        detail: { Daniel: savings?.d_saved || 0, Jacky: savings?.j_saved || 0 }
      },
      timestamp: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
    };

    return new Response(JSON.stringify(result, null, 2), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
