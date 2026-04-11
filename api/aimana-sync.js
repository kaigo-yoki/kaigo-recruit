export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch(
      'https://asia-northeast1-aimana-8a09c.cloudfunctions.net/getCompanyData'
    );

    if (!response.ok) {
      throw new Error(`aimana API returned ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.company) {
      throw new Error('Invalid response from aimana API');
    }

    const company = data.company;

    // Return only the fields we need
    res.status(200).json({
      success: true,
      syncedAt: new Date().toISOString(),
      data: {
        insuredPersonCount: company.insuredPersonCount || 0,
        facilityGroups: company.facilityGroups || [],
        thisMonth: company.thisMonth || 0,
        lastMonth: company.lastMonth || 0,
        monthBeforeLast: company.monthBeforeLast || 0,
        lastActivityAt: company.lastActivityAt || null
      }
    });
  } catch (error) {
    console.error('aimana sync error:', error.message);
    res.status(500).json({
      success: false,
      error: '介護のまなAPIとの通信に失敗しました',
      detail: error.message
    });
  }
}
