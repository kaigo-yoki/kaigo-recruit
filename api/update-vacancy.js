export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const REPO_OWNER = 'kaigo-yoki';
  const REPO_NAME = 'kaigo-recruit';
  const FILE_PATH = 'data/vacancy.json';

  // GET: Read current vacancy.json from GitHub
  if (req.method === 'GET') {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            ...(GITHUB_TOKEN ? { 'Authorization': `Bearer ${GITHUB_TOKEN}` } : {})
          }
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}`);
      }

      const ghData = await response.json();
      const content = JSON.parse(
        Buffer.from(ghData.content, 'base64').toString('utf-8')
      );

      return res.status(200).json({
        success: true,
        data: content,
        sha: ghData.sha
      });
    } catch (error) {
      console.error('Read vacancy error:', error.message);
      return res.status(500).json({
        success: false,
        error: 'vacancy.json の読み込みに失敗しました'
      });
    }
  }

  // PUT: Update vacancy.json via GitHub API
  if (req.method === 'PUT') {
    if (!GITHUB_TOKEN) {
      return res.status(500).json({
        success: false,
        error: 'GITHUB_TOKEN が設定されていません。Vercel の環境変数に追加してください。'
      });
    }

    // Simple auth check - require admin password in header
    const adminAuth = req.headers['authorization'];
    if (!adminAuth || adminAuth !== 'Bearer youki8131') {
      return res.status(401).json({
        success: false,
        error: '認証に失敗しました'
      });
    }

    try {
      const { facilities, sha } = req.body;

      if (!facilities || !Array.isArray(facilities)) {
        return res.status(400).json({
          success: false,
          error: '施設データが不正です'
        });
      }

      const vacancyData = {
        lastUpdated: new Date().toISOString().split('T')[0],
        facilities: facilities.map(f => ({
          id: f.id,
          name: f.name,
          capacity: parseInt(f.capacity),
          occupied: parseInt(f.occupied)
        }))
      };

      const content = Buffer.from(
        JSON.stringify(vacancyData, null, 2) + '\n',
        'utf-8'
      ).toString('base64');

      // We need the current SHA to update
      let currentSha = sha;
      if (!currentSha) {
        const getRes = await fetch(
          `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
          {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              'Authorization': `Bearer ${GITHUB_TOKEN}`
            }
          }
        );
        if (getRes.ok) {
          const getData = await getRes.json();
          currentSha = getData.sha;
        }
      }

      const updateRes = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
        {
          method: 'PUT',
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `空床状況を更新 (${vacancyData.lastUpdated})`,
            content: content,
            sha: currentSha
          })
        }
      );

      if (!updateRes.ok) {
        const errData = await updateRes.json();
        throw new Error(errData.message || `GitHub API returned ${updateRes.status}`);
      }

      return res.status(200).json({
        success: true,
        message: '空床状況を更新しました。公開ページに約30秒で反映されます。',
        data: vacancyData
      });
    } catch (error) {
      console.error('Update vacancy error:', error.message);
      return res.status(500).json({
        success: false,
        error: `更新に失敗しました: ${error.message}`
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
