const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// ===== 設定 =====
const INDIVIDUAL_DIR = path.join(__dirname, '..', 'individual-training');
const INDIVIDUAL_JSON = path.join(INDIVIDUAL_DIR, 'individual.json');
const SITE_URL = 'https://kaigo-recruit.vercel.app';

// ===== 個別研修テーマ（年間計画 3か月に1回 × 3階層） =====
const INDIVIDUAL_THEMES = [
  // ===== 新人向け =====
  {
    id: 'new-q1',
    level: '新人向け',
    levelIcon: '🌱',
    levelColor: '#4CAF7D',
    quarter: 'Q1（4〜6月）',
    title: '基本介護技術と訪問介護のルール',
    subtitle: '〜 まずはここから！基本をマスター！ 〜',
    icon: '📖',
    description: '移乗・移動・体位変換の基本技術と、訪問介護で守るべきルールを学びます。',
    month: 4
  },
  {
    id: 'new-q2',
    level: '新人向け',
    levelIcon: '🌱',
    levelColor: '#4CAF7D',
    quarter: 'Q2（7〜9月）',
    title: 'コミュニケーション技術と利用者対応',
    subtitle: '〜 言葉ひとつで変わるケア！ 〜',
    icon: '💬',
    description: '利用者やご家族との信頼関係を築くコミュニケーション技術を学びます。',
    month: 7
  },
  {
    id: 'new-q3',
    level: '新人向け',
    levelIcon: '🌱',
    levelColor: '#4CAF7D',
    quarter: 'Q3（10〜12月）',
    title: '介護記録の書き方と報連相',
    subtitle: '〜 記録が命を守る！ 〜',
    icon: '📝',
    description: '正確な記録の書き方と、報告・連絡・相談（報連相）の重要性を学びます。',
    month: 10
  },
  {
    id: 'new-q4',
    level: '新人向け',
    levelIcon: '🌱',
    levelColor: '#4CAF7D',
    quarter: 'Q4（1〜3月）',
    title: 'ストレスマネジメントとセルフケア',
    subtitle: '〜 自分を大事にすることも仕事！ 〜',
    icon: '🧘',
    description: '介護職のメンタルヘルス管理と、ストレスとの上手な付き合い方を学びます。',
    month: 1
  },

  // ===== リーダー向け =====
  {
    id: 'leader-q1',
    level: 'リーダー向け',
    levelIcon: '⭐',
    levelColor: '#F9A826',
    quarter: 'Q1（4〜6月）',
    title: 'チームマネジメントと後輩指導',
    subtitle: '〜 育てる力がチームを強くする！ 〜',
    icon: '👥',
    description: 'チームをまとめるリーダーシップと、後輩を育てるOJTの手法を学びます。',
    month: 4
  },
  {
    id: 'leader-q2',
    level: 'リーダー向け',
    levelIcon: '⭐',
    levelColor: '#F9A826',
    quarter: 'Q2（7〜9月）',
    title: 'サービス提供責任者の役割と連携',
    subtitle: '〜 つなぐ力でケアの質を上げる！ 〜',
    icon: '🔗',
    description: 'サービス提供責任者の業務理解と、多職種連携のスキルを学びます。',
    month: 7
  },
  {
    id: 'leader-q3',
    level: 'リーダー向け',
    levelIcon: '⭐',
    levelColor: '#F9A826',
    quarter: 'Q3（10〜12月）',
    title: '事例検討とリスクマネジメント',
    subtitle: '〜 事例から学ぶ、事故を防ぐ知恵！ 〜',
    icon: '🔍',
    description: 'ヒヤリハット分析と事例検討のファシリテーション技術を学びます。',
    month: 10
  },
  {
    id: 'leader-q4',
    level: 'リーダー向け',
    levelIcon: '⭐',
    levelColor: '#F9A826',
    quarter: 'Q4（1〜3月）',
    title: 'クレーム対応とスタッフ支援',
    subtitle: '〜 ピンチをチャンスに変える！ 〜',
    icon: '🛎️',
    description: 'クレーム対応の手順と、スタッフのモチベーション管理を学びます。',
    month: 1
  },

  // ===== 管理者向け =====
  {
    id: 'manager-q1',
    level: '管理者向け',
    levelIcon: '👔',
    levelColor: '#2D5A8E',
    quarter: 'Q1（4〜6月）',
    title: '労務管理と人材育成計画',
    subtitle: '〜 人を育てる組織をつくる！ 〜',
    icon: '📊',
    description: '労働基準法の基礎と、効果的な人材育成計画の立て方を学びます。',
    month: 4
  },
  {
    id: 'manager-q2',
    level: '管理者向け',
    levelIcon: '👔',
    levelColor: '#2D5A8E',
    quarter: 'Q2（7〜9月）',
    title: '運営指導対策と書類管理',
    subtitle: '〜 備えあれば指導も怖くない！ 〜',
    icon: '📋',
    description: '運営指導（実地指導）への準備と、必要書類の整備方法を学びます。',
    month: 7
  },
  {
    id: 'manager-q3',
    level: '管理者向け',
    levelIcon: '👔',
    levelColor: '#2D5A8E',
    quarter: 'Q3（10〜12月）',
    title: '介護報酬と加算の理解',
    subtitle: '〜 正しく請求、正しく運営！ 〜',
    icon: '💰',
    description: '介護報酬の仕組みと各種加算の要件、請求時の注意点を学びます。',
    month: 10
  },
  {
    id: 'manager-q4',
    level: '管理者向け',
    levelIcon: '👔',
    levelColor: '#2D5A8E',
    quarter: 'Q4（1〜3月）',
    title: '経営戦略と次年度事業計画',
    subtitle: '〜 未来を見据えた事業所づくり！ 〜',
    icon: '🎯',
    description: '介護事業所の経営分析と、次年度に向けた事業計画策定を学びます。',
    month: 1
  }
];

// ===== ユーティリティ =====
function getToday() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split('T')[0];
}

function getGeneratedIds() {
  if (!fs.existsSync(INDIVIDUAL_JSON)) return [];
  const trainings = JSON.parse(fs.readFileSync(INDIVIDUAL_JSON, 'utf-8'));
  return trainings.map(t => t.id);
}

// ===== 研修コンテンツ生成 =====
async function generateContent(theme) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const systemPrompt = `あなたは訪問介護事業所「訪問介護ようき」（有限会社 陽気、沖縄県南城市）の個別研修コンテンツを作成する専門家です。

## 対象レベル: ${theme.level}
## テーマ: ${theme.title}

## フォーマット（厳守）
以下の3人のキャラクターによる漫画風の会話形式で研修を作成してください：

1. **ダジャレ所長（おやじ先生）** 🧔 — 研修講師。親父ギャグを随所に挟む。
2. **さくら（新人ヘルパー）** 👩 — 質問役。読者の代弁者。
3. **みさき先輩（ツッコミ担当）** 👩‍🦰 — ツッコミつつ要点をまとめる。

## ${theme.level}の研修として意識すること
${theme.level === '新人向け' ? '- 専門用語は必ず解説をつける\n- 具体的な手順やチェックリストを多く含める\n- 「失敗しても大丈夫」という安心感を与える\n- 先輩の体験談を交えて親しみやすく' : ''}
${theme.level === 'リーダー向け' ? '- 基本は理解している前提で、応用的な内容にする\n- マネジメントの具体的なフレームワークや手法を紹介\n- 部下への指導方法や声かけの具体例を含める\n- 実際のケーススタディを豊富に含める' : ''}
${theme.level === '管理者向け' ? '- 経営的な視点と法令の根拠を重視する\n- 数値やデータに基づく内容を含める\n- 制度改正への対応など最新情報を意識する\n- 具体的な帳票やフォーマットの例を示す' : ''}

## 構成（必須要素）
1. **導入**（会話 + ダジャレ + 目次）
2. **本編**（3〜5セクション。各セクションに会話・法律根拠・シナリオ・ダジャレ・ハイライトボックスを含む）
3. **確認クイズ**（3問。各問4択、正解1つ、解説付き）
4. **まとめ**（要点リスト + 励ましメッセージ）

## HTML出力形式
以下のCSSクラスを使用：
- 会話: <div class="speech"> / <div class="speech right">
  - アバター: <div class="speech-avatar oyaji/student/tsukkomi">🧔/👩/👩‍🦰</div>
  - 吹き出し: <div class="speech-bubble bubble-oyaji/student/tsukkomi">
- ダジャレ: <div class="oyaji-gag"><div class="gag-text">...</div><div class="gag-sub">※注釈</div></div>
- シーン: <div class="shiin">シーーーン</div>
- ハイライト: <div class="highlight-box law/important/danger/good">
- シナリオ: <div class="scenario"><div class="scenario-title">📖 こんな場面を想像してみよう</div>...</div>
- クイズ: <div class="quiz-box">...<button class="quiz-option" onclick="checkQuiz(this, true/false)">...</button>...<div class="quiz-feedback">解説</div></div>
- ポイントリスト: <ul class="point-list"><li>...</li></ul>
- 各ブロックは <div class="manga-panel"> で囲む`;

  const userPrompt = `以下のテーマで${theme.level}の個別研修コンテンツを作成してください。

テーマ: 「${theme.title}」
サブタイトル: ${theme.subtitle}
対象: ${theme.level}
期間: ${theme.quarter}

JSON形式で出力（コードブロックなし）:
{
  "pages": [
    {
      "chapter": "はじめに",
      "title": "今日の研修メニュー 📋",
      "content": "HTMLコンテンツ（導入会話・ダジャレ・目次のtoc-itemを含む）"
    },
    {
      "chapter": "第1章",
      "title": "セクションタイトル",
      "content": "HTMLコンテンツ（manga-panelで囲んだ会話・ダジャレ・ハイライトボックス・シナリオ）"
    },
    ... (第2章〜第4章)
    {
      "chapter": "確認クイズ",
      "title": "確認クイズ＆まとめ",
      "content": "3問のクイズとまとめポイントリスト、修了メッセージ"
    }
  ]
}

重要:
- 各pageのcontentは<div class="manga-panel">で囲んだブロックを複数含める
- 各章は十分な内容量（会話3-5往復+ハイライトボックス2-3個+ダジャレ1-2個）
- クイズのonclickは checkQuiz(this, true) が正解、checkQuiz(this, false) が不正解
- 目次には各章へのリンク: <div class="toc-item" onclick="goToPage(N)">
- ${theme.level}のレベルに合わせた深さの内容にする`;

  console.log('OpenAI API で研修コンテンツを生成中...');
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 8000,
  });

  const content = response.choices[0].message.content.trim();
  try {
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('JSON解析エラー:', err.message);
    console.error('先頭500文字:', content.substring(0, 500));
    throw new Error('JSON解析に失敗');
  }
}

// ===== HTMLテンプレート =====
function buildHTML(theme, data) {
  const pages = data.pages;
  const totalPages = pages.length;

  let pagesHTML = '';
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    let content = page.content;
    // 目次ページの自動補完
    if (i === 0 && !content.includes('toc-item')) {
      let tocItems = '';
      for (let j = 1; j < pages.length; j++) {
        tocItems += `<div class="toc-item" onclick="goToPage(${j + 1})"><div class="toc-num">${j}</div><div class="toc-text">${pages[j].title}</div></div>\n`;
      }
      content += `\n<div class="toc">\n${tocItems}</div>`;
    }
    pagesHTML += `
<div class="page" id="page${i + 1}">
  <div class="page-header">
    <div class="page-chapter">${page.chapter}</div>
    <div class="page-title">${page.title}</div>
  </div>
  ${content}
</div>`;
  }

  // レベルに応じたグラデーション
  const gradients = {
    '新人向け': 'linear-gradient(135deg, #43A047 0%, #66BB6A 50%, #A5D6A7 100%)',
    'リーダー向け': 'linear-gradient(135deg, #FF8F00 0%, #FFB300 50%, #FFE082 100%)',
    '管理者向け': 'linear-gradient(135deg, #1565C0 0%, #42A5F5 50%, #90CAF9 100%)'
  };
  const bgGradient = gradients[theme.level] || gradients['新人向け'];
  const progressGradients = {
    '新人向け': 'linear-gradient(90deg, #43A047, #A5D6A7)',
    'リーダー向け': 'linear-gradient(90deg, #FF8F00, #FFE082)',
    '管理者向け': 'linear-gradient(90deg, #1565C0, #90CAF9)'
  };

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${theme.level} ${theme.title} | 訪問介護 ようき 個別研修</title>
<meta name="description" content="${theme.description} 訪問介護ようき（有限会社 陽気）の${theme.level}個別研修。">
<link rel="canonical" href="${SITE_URL}/individual-training/${theme.id}">
<link rel="icon" type="image/png" href="../favicon.png">
<style>
@import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700;900&family=Kosugi+Maru&display=swap');
:root{--primary:${theme.levelColor};--primary-light:${theme.levelColor}CC;--accent:#E8594F;--warm:#F9A826;--green:#4CAF7D;--bg:#FFF8F0;--panel-bg:#FFFFFF;--text:#2C2C2C;--text-light:#666666;}
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Zen Maru Gothic','Kosugi Maru',sans-serif;background:var(--bg);color:var(--text);overflow-x:hidden;}
.title-screen{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${bgGradient};position:relative;overflow:hidden;}
.title-screen::before{content:'';position:absolute;inset:0;background:url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.08'%3E%3Ctext x='10' y='45' font-size='30'%3E📚%3C/text%3E%3C/g%3E%3C/svg%3E");}
.title-badge{background:rgba(255,255,255,.25);color:white;padding:8px 28px;border-radius:30px;font-size:14px;font-weight:700;letter-spacing:2px;margin-bottom:12px;position:relative;z-index:1;animation:bounceIn .8s ease;backdrop-filter:blur(4px);}
.title-level{background:white;color:${theme.levelColor};padding:6px 20px;border-radius:20px;font-size:13px;font-weight:900;margin-bottom:16px;position:relative;z-index:1;animation:fadeUp 1s ease .15s both;}
.title-main{font-size:clamp(24px,5.5vw,44px);font-weight:900;color:white;text-align:center;line-height:1.4;position:relative;z-index:1;animation:fadeUp 1s ease .3s both;text-shadow:0 3px 12px rgba(0,0,0,.2);}
.title-sub{font-size:clamp(13px,2.5vw,18px);color:rgba(255,255,255,.95);margin-top:14px;position:relative;z-index:1;animation:fadeUp 1s ease .6s both;text-align:center;line-height:1.6;}
.title-characters{display:flex;gap:30px;margin-top:28px;position:relative;z-index:1;animation:fadeUp 1s ease .9s both;flex-wrap:wrap;justify-content:center;}
.title-char{text-align:center;}
.title-char-icon{width:80px;height:80px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:40px;margin-bottom:6px;border:4px solid rgba(255,255,255,.6);box-shadow:0 4px 20px rgba(0,0,0,.15);}
.title-char-name{color:white;font-weight:700;font-size:12px;text-shadow:0 1px 4px rgba(0,0,0,.2);}
.start-btn{margin-top:32px;padding:14px 44px;background:white;color:${theme.levelColor};border:none;border-radius:50px;font-size:18px;font-weight:700;font-family:inherit;cursor:pointer;position:relative;z-index:1;animation:fadeUp 1s ease 1.2s both,pulse 2s ease-in-out 2.5s infinite;box-shadow:0 4px 20px rgba(0,0,0,.2);transition:transform .2s;}
.start-btn:hover{transform:scale(1.05);}
.progress-bar{position:fixed;top:0;left:0;right:0;height:5px;background:rgba(0,0,0,.1);z-index:100;}
.progress-fill{height:100%;background:${progressGradients[theme.level]};transition:width .5s ease;border-radius:0 3px 3px 0;}
.page{display:none;min-height:100vh;padding:24px 16px 100px;max-width:800px;margin:0 auto;animation:fadeIn .6s ease;}
.page.active{display:block;}
.page-header{text-align:center;margin:20px 0 30px;}
.page-chapter{display:inline-block;background:var(--primary);color:white;padding:4px 16px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:1px;margin-bottom:8px;}
.page-title{font-size:clamp(22px,5vw,32px);font-weight:900;color:var(--primary);line-height:1.3;}
.manga-panel{background:var(--panel-bg);border-radius:16px;padding:24px;margin-bottom:20px;box-shadow:0 2px 12px rgba(0,0,0,.06);border:2px solid #EEE;opacity:0;transform:translateY(20px);animation:panelIn .5s ease forwards;}
.manga-panel:nth-child(2){animation-delay:.15s;}.manga-panel:nth-child(3){animation-delay:.3s;}.manga-panel:nth-child(4){animation-delay:.45s;}.manga-panel:nth-child(5){animation-delay:.6s;}.manga-panel:nth-child(6){animation-delay:.75s;}
.speech{display:flex;gap:12px;margin-bottom:16px;align-items:flex-start;}.speech.right{flex-direction:row-reverse;}
.speech-avatar{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0;border:3px solid;}
.speech-avatar.oyaji{background:#FFF3E0;border-color:#FF8F00;}.speech-avatar.student{background:#E3F2FD;border-color:#4A8FD4;}.speech-avatar.tsukkomi{background:#F3E5F5;border-color:#AB47BC;}
.speech-bubble{padding:14px 18px;border-radius:16px;font-size:15px;line-height:1.7;max-width:85%;position:relative;}
.bubble-oyaji{background:#FFF3E0;border:2px solid #FFE0B2;border-radius:16px 16px 16px 4px;}.bubble-student{background:#E3F2FD;border:2px solid #BBDEFB;border-radius:16px 16px 4px 16px;}.bubble-tsukkomi{background:#F3E5F5;border:2px solid #E1BEE7;border-radius:16px 16px 4px 16px;}
.speech-name{font-size:11px;font-weight:700;color:var(--text-light);margin-bottom:4px;}
.oyaji-gag{background:linear-gradient(135deg,#FFF9C4,#FFF176);border:3px solid #FFD54F;border-radius:16px;padding:16px 20px;margin:14px 0;text-align:center;position:relative;animation:gagPop .5s ease;}
.oyaji-gag::before{content:'\\1F4A5';position:absolute;top:-14px;left:50%;transform:translateX(-50%);font-size:28px;}
.gag-text{font-size:20px;font-weight:900;color:#E65100;letter-spacing:2px;}.gag-sub{font-size:12px;color:#BF360C;margin-top:4px;font-weight:500;}
.shiin{text-align:center;font-size:28px;font-weight:900;color:#90A4AE;letter-spacing:12px;margin:8px 0;animation:shiinFade 1.5s ease;}
.highlight-box{border-radius:12px;padding:20px;margin:16px 0;}.highlight-box.law{background:linear-gradient(135deg,#E8EAF6,#C5CAE9);border-left:5px solid #3F51B5;}.highlight-box.important{background:linear-gradient(135deg,#FFF3E0,#FFE0B2);border-left:5px solid var(--warm);}.highlight-box.danger{background:linear-gradient(135deg,#FFEBEE,#FFCDD2);border-left:5px solid var(--accent);}.highlight-box.good{background:linear-gradient(135deg,#E8F5E9,#C8E6C9);border-left:5px solid var(--green);}
.highlight-box .box-title{font-weight:900;font-size:15px;margin-bottom:8px;display:flex;align-items:center;gap:6px;}.highlight-box .box-content{font-size:14px;line-height:1.8;}
.scenario{background:#F5F5F5;border-radius:12px;padding:20px;margin:16px 0;border:2px dashed #CCC;}.scenario-title{font-size:13px;font-weight:700;color:var(--accent);margin-bottom:10px;}
.quiz-box{background:white;border:3px solid var(--primary);border-radius:16px;padding:24px;margin:20px 0;}.quiz-question{font-size:16px;font-weight:700;margin-bottom:16px;color:var(--primary);}.quiz-options{display:flex;flex-direction:column;gap:10px;}
.quiz-option{padding:14px 18px;background:#F5F5F5;border:2px solid #DDD;border-radius:12px;cursor:pointer;font-size:14px;font-family:inherit;text-align:left;transition:all .3s;line-height:1.5;}
.quiz-option:hover{border-color:var(--primary-light);background:#E3F2FD;}.quiz-option.correct{background:#E8F5E9;border-color:var(--green);}.quiz-option.wrong{background:#FFEBEE;border-color:var(--accent);}
.quiz-feedback{margin-top:14px;padding:14px;border-radius:10px;font-size:14px;line-height:1.7;display:none;}.quiz-feedback.show{display:block;}
.point-list{list-style:none;padding:0;}.point-list li{padding:10px 0 10px 36px;position:relative;font-size:15px;line-height:1.6;border-bottom:1px solid #EEE;}
.point-list li::before{content:'\\2713';position:absolute;left:0;width:24px;height:24px;background:var(--green);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;top:12px;}
.nav-bar{position:fixed;bottom:0;left:0;right:0;background:white;border-top:2px solid #EEE;padding:12px 20px;display:flex;justify-content:space-between;align-items:center;z-index:50;}
.nav-btn{padding:10px 24px;border:none;border-radius:30px;font-size:15px;font-weight:700;font-family:inherit;cursor:pointer;transition:all .2s;}
.nav-btn.prev{background:#EEE;color:var(--text);}.nav-btn.next{background:var(--primary);color:white;box-shadow:0 2px 10px rgba(0,0,0,.15);}
.nav-btn:hover{transform:translateY(-2px);}.nav-btn:disabled{opacity:.3;cursor:default;transform:none;}
.nav-page{font-size:13px;color:var(--text-light);font-weight:700;}
.toc{display:grid;gap:12px;margin-top:20px;}.toc-item{display:flex;align-items:center;gap:14px;padding:16px;background:white;border-radius:12px;border:2px solid #EEE;cursor:pointer;transition:all .3s;}
.toc-item:hover{border-color:var(--primary-light);transform:translateX(4px);}.toc-num{width:36px;height:36px;border-radius:50%;background:var(--primary);color:white;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16px;flex-shrink:0;}.toc-text{font-size:15px;font-weight:700;}
.ending{text-align:center;padding:40px 20px;}.ending-icon{font-size:80px;margin-bottom:16px;}.ending-title{font-size:28px;font-weight:900;color:var(--primary);margin-bottom:12px;}.ending-msg{font-size:16px;color:var(--text-light);line-height:1.8;}
.certificate{background:linear-gradient(135deg,#FFF8E1,#FFECB3);border:3px solid var(--warm);border-radius:16px;padding:30px;margin:30px auto;max-width:500px;}
.certificate-title{font-size:22px;font-weight:900;color:var(--warm);}.certificate-body{font-size:14px;margin-top:12px;line-height:1.8;}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}@keyframes fadeUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}@keyframes bounceIn{0%{transform:scale(0);}60%{transform:scale(1.1);}100%{transform:scale(1);}}@keyframes panelIn{to{opacity:1;transform:translateY(0);}}@keyframes pulse{0%,100%{box-shadow:0 4px 20px rgba(0,0,0,.2);}50%{box-shadow:0 4px 30px rgba(0,0,0,.35);}}@keyframes gagPop{0%{transform:scale(.5) rotate(-5deg);opacity:0;}50%{transform:scale(1.1) rotate(2deg);}100%{transform:scale(1) rotate(0);}}@keyframes shiinFade{0%{opacity:0;letter-spacing:2px;}100%{opacity:1;letter-spacing:12px;}}
@media(max-width:600px){.speech-avatar{width:44px;height:44px;font-size:22px;}.speech-bubble{font-size:13px;}.gag-text{font-size:17px;}}
</style>
</head>
<body>
<div class="title-screen" id="titleScreen">
  <div class="title-badge">訪問介護 個別研修</div>
  <div class="title-level">${theme.levelIcon} ${theme.level} ｜ ${theme.quarter}</div>
  <div class="title-main">${theme.icon} ${theme.title}</div>
  <div class="title-sub">${theme.subtitle}<br>※ ギャグのクオリティは保証しません</div>
  <div class="title-characters">
    <div class="title-char"><div class="title-char-icon" style="background:#FFF3E0;">🧔</div><div class="title-char-name">ダジャレ所長</div></div>
    <div class="title-char"><div class="title-char-icon" style="background:#E3F2FD;">👩</div><div class="title-char-name">さくら</div></div>
    <div class="title-char"><div class="title-char-icon" style="background:#F3E5F5;">👩‍🦰</div><div class="title-char-name">みさき先輩</div></div>
  </div>
  <button class="start-btn" onclick="startTraining()">▶ 研修をはじめる</button>
</div>
<div class="progress-bar" id="progressBar" style="display:none;"><div class="progress-fill" id="progressFill"></div></div>
${pagesHTML}
<div class="nav-bar" id="navBar" style="display:none;">
  <button class="nav-btn prev" id="prevBtn" onclick="prevPage()">◀ 前へ</button>
  <span class="nav-page" id="pageNum">1 / ${totalPages}</span>
  <button class="nav-btn next" id="nextBtn" onclick="nextPage()">次へ ▶</button>
</div>
<script>
let currentPage=0;const totalPages=${totalPages};
function startTraining(){document.getElementById('titleScreen').style.display='none';document.getElementById('progressBar').style.display='block';document.getElementById('navBar').style.display='flex';currentPage=1;showPage(currentPage);}
function showPage(n){document.querySelectorAll('.page').forEach(p=>{p.classList.remove('active');});const page=document.getElementById('page'+n);if(page){page.classList.add('active');page.querySelectorAll('.manga-panel').forEach(p=>{p.style.animation='none';p.offsetHeight;p.style.animation='';});}document.getElementById('prevBtn').disabled=(n<=1);document.getElementById('nextBtn').textContent=(n>=totalPages)?'🎉 完了！':'次へ ▶';document.getElementById('pageNum').textContent=n+' / '+totalPages;document.getElementById('progressFill').style.width=((n/totalPages)*100)+'%';window.scrollTo({top:0,behavior:'smooth'});}
function nextPage(){if(currentPage<totalPages){currentPage++;showPage(currentPage);}}
function prevPage(){if(currentPage>1){currentPage--;showPage(currentPage);}}
function goToPage(n){currentPage=n;showPage(n);}
function checkQuiz(btn,isCorrect){const qb=btn.closest('.quiz-box');const opts=qb.querySelectorAll('.quiz-option');opts.forEach(o=>{o.disabled=true;o.style.pointerEvents='none';});if(isCorrect){btn.classList.add('correct');const fb=qb.querySelector('.quiz-feedback');if(fb){fb.classList.add('show');fb.style.background='#E8F5E9';}}else{btn.classList.add('wrong');opts.forEach(o=>{if(o.getAttribute('onclick')&&o.getAttribute('onclick').includes('true'))o.classList.add('correct');});const fb=qb.querySelector('.quiz-feedback');if(fb){fb.classList.add('show');fb.style.background='#FFEBEE';}}}
</script>
</body>
</html>`;
}

// ===== メイン処理 =====
async function main() {
  console.log('個別研修コンテンツの自動生成を開始します...');
  if (!fs.existsSync(INDIVIDUAL_DIR)) fs.mkdirSync(INDIVIDUAL_DIR, { recursive: true });

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY が設定されていません。');
    process.exit(1);
  }

  const generatedIds = getGeneratedIds();
  const theme = INDIVIDUAL_THEMES.find(t => !generatedIds.includes(t.id));

  if (!theme) {
    console.log('全テーマ生成済みです。');
    return;
  }

  const outputFile = path.join(INDIVIDUAL_DIR, `${theme.id}.html`);
  if (fs.existsSync(outputFile)) {
    console.log(`スキップ: ${theme.id}.html は既に存在`);
    return;
  }

  console.log(`テーマ: [${theme.level}] ${theme.title}（ID: ${theme.id}）`);

  const data = await generateContent(theme);
  console.log(`生成完了: ${data.pages.length} ページ`);

  const html = buildHTML(theme, data);
  fs.writeFileSync(outputFile, html, 'utf-8');
  console.log(`ファイル作成: individual-training/${theme.id}.html`);

  let trainings = [];
  if (fs.existsSync(INDIVIDUAL_JSON)) {
    trainings = JSON.parse(fs.readFileSync(INDIVIDUAL_JSON, 'utf-8'));
  }

  trainings.push({
    id: theme.id,
    level: theme.level,
    levelIcon: theme.levelIcon,
    quarter: theme.quarter,
    title: theme.title,
    subtitle: theme.subtitle,
    icon: theme.icon,
    description: theme.description,
    file: `${theme.id}.html`,
    date: getToday(),
  });

  fs.writeFileSync(INDIVIDUAL_JSON, JSON.stringify(trainings, null, 2), 'utf-8');
  console.log('individual.json を更新しました。');
  console.log(`生成済み: ${trainings.length} / ${INDIVIDUAL_THEMES.length}`);
  console.log('完了!');
}

main().catch(err => {
  console.error('エラー:', err.message);
  process.exit(1);
});
