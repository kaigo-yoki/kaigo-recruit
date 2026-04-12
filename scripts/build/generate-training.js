const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// ===== 設定 =====
const TRAININGS_DIR = path.join(__dirname, '..', 'trainings');
const TRAININGS_JSON = path.join(TRAININGS_DIR, 'trainings.json');
const SITE_URL = 'https://kaigo-yoki.jp/recruit';

// ===== 法定研修テーマプール（厚生労働省準拠） =====
const TRAINING_THEMES = [
  {
    id: 'privacy',
    title: 'プライバシー保護・個人情報保護',
    subtitle: '〜 秘密はヒミツのままに！ 〜',
    icon: '🔒',
    description: '個人情報保護法と介護現場でのプライバシー保護のルールを学びます。'
  },
  {
    id: 'dementia',
    title: '認知症及び認知症ケア',
    subtitle: '〜 寄り添う心で支えよう！ 〜',
    icon: '🧠',
    description: '認知症の基本的な理解と、適切なケアの方法を学びます。'
  },
  {
    id: 'abuse-prevention',
    title: '高齢者虐待防止・人権擁護',
    subtitle: '〜 守るべきは尊厳だ！ 〜',
    icon: '🛡️',
    description: '高齢者虐待の種類と防止策、人権擁護について学びます。'
  },
  {
    id: 'accident-prevention',
    title: '事故発生又は再発防止',
    subtitle: '〜 転ばぬ先の知恵！ 〜',
    icon: '⚠️',
    description: '介護現場での事故防止と、万が一の際の対応方法を学びます。'
  },
  {
    id: 'emergency',
    title: '緊急時の対応',
    subtitle: '〜 いざという時に慌てない！ 〜',
    icon: '🚨',
    description: '利用者の急変時や災害時の緊急対応について学びます。'
  },
  {
    id: 'infection-control',
    title: '感染症・食中毒の予防と蔓延防止',
    subtitle: '〜 バイキンにバイバイキン！ 〜',
    icon: '🦠',
    description: '感染症・食中毒の予防策と、発生時の対応を学びます。'
  },
  {
    id: 'hospitality',
    title: '接遇・マナー',
    subtitle: '〜 笑顔は最高のケア！ 〜',
    icon: '😊',
    description: '利用者やご家族への接し方、ビジネスマナーを学びます。'
  },
  {
    id: 'harassment',
    title: 'ハラスメント防止',
    subtitle: '〜 一人で抱え込まないで！ 〜',
    icon: '🤝',
    description: '職場やサービス現場でのハラスメント防止と対策を学びます。'
  },
  {
    id: 'bcp',
    title: '業務継続計画（BCP）・災害対応',
    subtitle: '〜 備えあれば憂いなし！ 〜',
    icon: '🏗️',
    description: '感染症や災害発生時の業務継続計画について学びます。'
  }
];

// ===== ユーティリティ =====
function getToday() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split('T')[0];
}

function getGeneratedIds() {
  if (!fs.existsSync(TRAININGS_JSON)) return [];
  const trainings = JSON.parse(fs.readFileSync(TRAININGS_JSON, 'utf-8'));
  return trainings.map(t => t.id);
}

function pickTheme(generatedIds) {
  const available = TRAINING_THEMES.filter(t => !generatedIds.includes(t.id));
  if (available.length === 0) {
    console.log('全テーマ生成済みです。');
    return null;
  }
  return available[0]; // 順番通りに生成
}

// ===== 研修コンテンツ生成 =====
async function generateTrainingContent(theme) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const systemPrompt = `あなたは訪問介護事業所「訪問介護ようき」（有限会社 陽気、沖縄県南城市）の法定研修コンテンツを作成する専門家です。

## フォーマット（厳守）
以下の3人のキャラクターによる漫画風の会話形式で研修を作成してください：

1. **ダジャレ所長（おやじ先生）** 🧔 — 研修講師。真面目な内容をダジャレで記憶に残す。親父ギャグを随所に挟む。
2. **さくら（新人ヘルパー）** 👩 — 新人で素朴な質問をする。読者の代弁者。
3. **みさき先輩（ツッコミ担当）** 👩‍🦰 — 所長のダジャレにツッコミつつ、要点をまとめる。

## 構成（必須要素）
1. **導入**（キャラクターの会話 + ダジャレ1個）
2. **本編**（3〜5つのセクション。各セクションに以下を含む）:
   - キャラクターの会話で概念を説明
   - 法律・制度の根拠（具体的な法律名を明記）
   - 「こんな場面を想像してみよう」シナリオ（実際の訪問介護現場で起こりそうな事例）
   - ダジャレ（各セクション1〜2個）+ ツッコミ
   - ハイライトボックス（重要ポイント、NG行為、正しい対応）
3. **確認クイズ**（3問。各問に選択肢4つ、正解1つ、解説付き）
4. **まとめ**（要点リスト + 励ましメッセージ）

## ダジャレのルール
- 研修テーマに関連したダジャレにする
- 「シーーーン」という反応を入れる
- みさき先輩がツッコミを入れる
- ダジャレの後に「※ 〇〇という意味です」と注釈を入れる

## 品質基準
- **厚生労働省の指針に準拠**した正確な情報を含めること
- 具体的な**法律名**と**条文の趣旨**を明記すること
- 訪問介護の**実際の現場**で起こりやすい事例を使うこと
- 笑えるけど**学びがある**内容にすること
- 各セクションは十分な分量を持たせること（短すぎるのはNG）

## HTML出力形式
以下のHTMLクラスを使用してコンテンツを構成してください：

会話:
\`\`\`html
<div class="speech"><!-- または class="speech right" -->
  <div class="speech-avatar oyaji">🧔</div><!-- oyaji/student/tsukkomi -->
  <div class="speech-bubble bubble-oyaji"><!-- bubble-oyaji/bubble-student/bubble-tsukkomi -->
    <div class="speech-name">ダジャレ所長</div>
    セリフ内容
  </div>
</div>
\`\`\`

ダジャレ:
\`\`\`html
<div class="oyaji-gag">
  <div class="gag-text">ダジャレ本文</div>
  <div class="gag-sub">※ 注釈</div>
</div>
<div class="shiin">シーーーン</div>
\`\`\`

ハイライトボックス:
\`\`\`html
<div class="highlight-box law"><!-- law/important/danger/good -->
  <div class="box-title">📘 タイトル</div>
  <div class="box-content">内容</div>
</div>
\`\`\`

シナリオ:
\`\`\`html
<div class="scenario">
  <div class="scenario-title">📖 こんな場面を想像してみよう</div>
  <p>シナリオ内容</p>
</div>
\`\`\`

クイズ:
\`\`\`html
<div class="quiz-box">
  <div class="quiz-question">❓ クイズX: 問題文</div>
  <div class="quiz-options">
    <button class="quiz-option" onclick="checkQuiz(this, false)">A. 選択肢</button>
    <button class="quiz-option" onclick="checkQuiz(this, true)">B. 正解の選択肢</button>
    <button class="quiz-option" onclick="checkQuiz(this, false)">C. 選択肢</button>
    <button class="quiz-option" onclick="checkQuiz(this, false)">D. 選択肢</button>
  </div>
  <div class="quiz-feedback">解説</div>
</div>
\`\`\`

ポイントリスト:
\`\`\`html
<ul class="point-list">
  <li>ポイント1</li>
  <li>ポイント2</li>
</ul>
\`\`\``;

  const userPrompt = `以下のテーマで法定研修コンテンツを作成してください。

テーマ: 「${theme.title}」
サブタイトル: ${theme.subtitle}
アイコン: ${theme.icon}

## 出力形式
JSON形式で出力してください（コードブロックなし、純粋なJSONのみ）:
{
  "pages": [
    {
      "chapter": "はじめに",
      "title": "今日の研修メニュー 📋",
      "content": "HTML形式のコンテンツ（目次を含む導入部分。キャラクターの自己紹介会話とダジャレ、テーマの概要説明を含めてください）"
    },
    {
      "chapter": "第1章",
      "title": "セクションタイトル",
      "content": "HTML形式のコンテンツ（manga-panelで囲んだ会話、ダジャレ、ハイライトボックス、シナリオを含む。十分な分量にしてください）"
    },
    {
      "chapter": "第2章",
      "title": "セクションタイトル",
      "content": "同上"
    },
    {
      "chapter": "第3章",
      "title": "セクションタイトル",
      "content": "同上"
    },
    {
      "chapter": "第4章",
      "title": "セクションタイトル",
      "content": "同上（必要に応じて第5章まで追加可）"
    },
    {
      "chapter": "確認クイズ",
      "title": "確認クイズ＆まとめ",
      "content": "3問のクイズとまとめのポイントリスト、修了メッセージを含むHTML"
    }
  ]
}

重要: 
- 各pageのcontentは<div class="manga-panel">で囲んだブロックを複数含めてください
- 各章は十分な内容量を持たせてください（会話3-5往復 + ハイライトボックス2-3個 + ダジャレ1-2個）
- クイズのonclickは checkQuiz(this, true) が正解、checkQuiz(this, false) が不正解です
- 目次ページには各章へのリンクボタン（toc-item）を含めてください`;

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
    // JSON部分を抽出（コードブロックで囲まれている場合に対応）
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('JSON解析エラー:', err.message);
    console.error('生成された内容の先頭500文字:', content.substring(0, 500));
    throw new Error('研修コンテンツのJSON解析に失敗しました');
  }
}

// ===== HTMLテンプレート =====
function buildTrainingHTML(theme, trainingData) {
  const pages = trainingData.pages;
  const totalPages = pages.length;

  let pagesHTML = '';

  // 目次ページ（page1）
  const tocPage = pages[0];
  // 目次のcontentにtoc-itemが含まれていない場合、自動生成
  let tocContent = tocPage.content;
  if (!tocContent.includes('toc-item')) {
    let tocItems = '';
    for (let i = 1; i < pages.length; i++) {
      tocItems += `<div class="toc-item" onclick="goToPage(${i + 1})"><div class="toc-num">${i}</div><div class="toc-text">${pages[i].title.replace(/ [^\s]+$/, '')}</div></div>\n`;
    }
    tocContent += `\n<div class="toc">\n${tocItems}</div>`;
  }

  pagesHTML += `
<div class="page" id="page1">
  <div class="page-header">
    <div class="page-chapter">${tocPage.chapter}</div>
    <div class="page-title">${tocPage.title}</div>
  </div>
  ${tocContent}
</div>`;

  // 本編ページ
  for (let i = 1; i < pages.length; i++) {
    const page = pages[i];
    pagesHTML += `
<div class="page" id="page${i + 1}">
  <div class="page-header">
    <div class="page-chapter">${page.chapter}</div>
    <div class="page-title">${page.title}</div>
  </div>
  ${page.content}
</div>`;
  }

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>訪問介護 ${theme.title} 研修 ${theme.subtitle}</title>
<meta name="description" content="${theme.description} 訪問介護ようき（有限会社 陽気）の法定研修コンテンツ。">
<link rel="canonical" href="${SITE_URL}/trainings/${theme.id}">
<link rel="icon" type="image/png" href="../favicon.png">
<style>
@import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700;900&family=Kosugi+Maru&display=swap');

:root {
  --primary: #2D5A8E;
  --primary-light: #4A8FD4;
  --accent: #E8594F;
  --warm: #F9A826;
  --green: #4CAF7D;
  --bg: #FFF8F0;
  --panel-bg: #FFFFFF;
  --text: #2C2C2C;
  --text-light: #666666;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Zen Maru Gothic', 'Kosugi Maru', sans-serif;
  background: var(--bg);
  color: var(--text);
  overflow-x: hidden;
}

.title-screen {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #FF6B35 0%, #F7C948 50%, #FFE066 100%);
  position: relative;
  overflow: hidden;
}

.title-screen::before {
  content: '';
  position: absolute;
  inset: 0;
  background: url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.08'%3E%3Ctext x='10' y='45' font-size='30'%3E😂%3C/text%3E%3C/g%3E%3C/svg%3E");
}

.title-badge {
  background: var(--accent);
  color: white;
  padding: 8px 28px;
  border-radius: 30px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 2px;
  margin-bottom: 20px;
  position: relative;
  z-index: 1;
  animation: bounceIn 0.8s ease;
}

.title-main {
  font-size: clamp(26px, 6vw, 48px);
  font-weight: 900;
  color: white;
  text-align: center;
  line-height: 1.4;
  position: relative;
  z-index: 1;
  animation: fadeUp 1s ease 0.3s both;
  text-shadow: 0 3px 12px rgba(0,0,0,0.2);
}

.title-sub {
  font-size: clamp(14px, 3vw, 20px);
  color: rgba(255,255,255,0.95);
  margin-top: 16px;
  position: relative;
  z-index: 1;
  animation: fadeUp 1s ease 0.6s both;
  text-align: center;
  line-height: 1.6;
}

.title-characters {
  display: flex;
  gap: 30px;
  margin-top: 30px;
  position: relative;
  z-index: 1;
  animation: fadeUp 1s ease 0.9s both;
  flex-wrap: wrap;
  justify-content: center;
}

.title-char { text-align: center; }

.title-char-icon {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 44px;
  margin-bottom: 8px;
  border: 4px solid rgba(255,255,255,0.6);
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
}

.title-char-name {
  color: white;
  font-weight: 700;
  font-size: 13px;
  text-shadow: 0 1px 4px rgba(0,0,0,0.2);
}

.start-btn {
  margin-top: 36px;
  padding: 16px 48px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 50px;
  font-size: 20px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  position: relative;
  z-index: 1;
  animation: fadeUp 1s ease 1.2s both, pulse 2s ease-in-out 2.5s infinite;
  box-shadow: 0 4px 20px rgba(45,90,142,0.4);
  transition: transform 0.2s;
}
.start-btn:hover { transform: scale(1.05); }

.progress-bar {
  position: fixed; top: 0; left: 0; right: 0;
  height: 5px; background: rgba(0,0,0,0.1); z-index: 100;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #FF6B35, #F7C948);
  transition: width 0.5s ease;
  border-radius: 0 3px 3px 0;
}

.page {
  display: none; min-height: 100vh; padding: 24px 16px 100px;
  max-width: 800px; margin: 0 auto; animation: fadeIn 0.6s ease;
}
.page.active { display: block; }

.page-header { text-align: center; margin: 20px 0 30px; }
.page-chapter {
  display: inline-block; background: var(--primary); color: white;
  padding: 4px 16px; border-radius: 20px; font-size: 12px;
  font-weight: 700; letter-spacing: 1px; margin-bottom: 8px;
}
.page-title {
  font-size: clamp(22px, 5vw, 32px); font-weight: 900;
  color: var(--primary); line-height: 1.3;
}

.manga-panel {
  background: var(--panel-bg); border-radius: 16px; padding: 24px;
  margin-bottom: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  border: 2px solid #EEE; opacity: 0; transform: translateY(20px);
  animation: panelIn 0.5s ease forwards;
}
.manga-panel:nth-child(2) { animation-delay: 0.15s; }
.manga-panel:nth-child(3) { animation-delay: 0.3s; }
.manga-panel:nth-child(4) { animation-delay: 0.45s; }
.manga-panel:nth-child(5) { animation-delay: 0.6s; }
.manga-panel:nth-child(6) { animation-delay: 0.75s; }

.speech { display: flex; gap: 12px; margin-bottom: 16px; align-items: flex-start; }
.speech.right { flex-direction: row-reverse; }

.speech-avatar {
  width: 56px; height: 56px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; flex-shrink: 0; border: 3px solid;
}
.speech-avatar.oyaji { background: #FFF3E0; border-color: #FF8F00; }
.speech-avatar.student { background: #E3F2FD; border-color: var(--primary-light); }
.speech-avatar.tsukkomi { background: #F3E5F5; border-color: #AB47BC; }

.speech-bubble {
  padding: 14px 18px; border-radius: 16px; font-size: 15px;
  line-height: 1.7; max-width: 85%; position: relative;
}

.bubble-oyaji { background: #FFF3E0; border: 2px solid #FFE0B2; border-radius: 16px 16px 16px 4px; }
.bubble-student { background: #E3F2FD; border: 2px solid #BBDEFB; border-radius: 16px 16px 4px 16px; }
.bubble-tsukkomi { background: #F3E5F5; border: 2px solid #E1BEE7; border-radius: 16px 16px 4px 16px; }

.speech-name { font-size: 11px; font-weight: 700; color: var(--text-light); margin-bottom: 4px; }

.oyaji-gag {
  background: linear-gradient(135deg, #FFF9C4, #FFF176);
  border: 3px solid #FFD54F;
  border-radius: 16px;
  padding: 16px 20px;
  margin: 14px 0;
  text-align: center;
  position: relative;
  animation: gagPop 0.5s ease;
}

.oyaji-gag::before {
  content: '\\1F4A5';
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 28px;
}

.gag-text {
  font-size: 20px;
  font-weight: 900;
  color: #E65100;
  letter-spacing: 2px;
}

.gag-sub {
  font-size: 12px;
  color: #BF360C;
  margin-top: 4px;
  font-weight: 500;
}

.tsukkomi-text {
  font-size: 14px;
  font-weight: 900;
  color: #7B1FA2;
  text-align: center;
  margin: 4px 0 10px;
  letter-spacing: 1px;
}

.shiin {
  text-align: center;
  font-size: 28px;
  font-weight: 900;
  color: #90A4AE;
  letter-spacing: 12px;
  margin: 8px 0;
  animation: shiinFade 1.5s ease;
}

.highlight-box { border-radius: 12px; padding: 20px; margin: 16px 0; }
.highlight-box.law { background: linear-gradient(135deg, #E8EAF6, #C5CAE9); border-left: 5px solid #3F51B5; }
.highlight-box.important { background: linear-gradient(135deg, #FFF3E0, #FFE0B2); border-left: 5px solid var(--warm); }
.highlight-box.danger { background: linear-gradient(135deg, #FFEBEE, #FFCDD2); border-left: 5px solid var(--accent); }
.highlight-box.good { background: linear-gradient(135deg, #E8F5E9, #C8E6C9); border-left: 5px solid var(--green); }
.highlight-box .box-title { font-weight: 900; font-size: 15px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
.highlight-box .box-content { font-size: 14px; line-height: 1.8; }

.scenario { background: #F5F5F5; border-radius: 12px; padding: 20px; margin: 16px 0; border: 2px dashed #CCC; }
.scenario-title { font-size: 13px; font-weight: 700; color: var(--accent); margin-bottom: 10px; }

.quiz-box { background: white; border: 3px solid var(--primary); border-radius: 16px; padding: 24px; margin: 20px 0; }
.quiz-question { font-size: 16px; font-weight: 700; margin-bottom: 16px; color: var(--primary); }
.quiz-options { display: flex; flex-direction: column; gap: 10px; }
.quiz-option {
  padding: 14px 18px; background: #F5F5F5; border: 2px solid #DDD;
  border-radius: 12px; cursor: pointer; font-size: 14px; font-family: inherit;
  text-align: left; transition: all 0.3s; line-height: 1.5;
}
.quiz-option:hover { border-color: var(--primary-light); background: #E3F2FD; }
.quiz-option.correct { background: #E8F5E9; border-color: var(--green); }
.quiz-option.wrong { background: #FFEBEE; border-color: var(--accent); }
.quiz-feedback { margin-top: 14px; padding: 14px; border-radius: 10px; font-size: 14px; line-height: 1.7; display: none; }
.quiz-feedback.show { display: block; }

.point-list { list-style: none; padding: 0; }
.point-list li {
  padding: 10px 0 10px 36px; position: relative;
  font-size: 15px; line-height: 1.6; border-bottom: 1px solid #EEE;
}
.point-list li::before {
  content: '\\2713'; position: absolute; left: 0;
  width: 24px; height: 24px; background: var(--green);
  color: white; border-radius: 50%; display: flex;
  align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; top: 12px;
}

.nav-bar {
  position: fixed; bottom: 0; left: 0; right: 0;
  background: white; border-top: 2px solid #EEE;
  padding: 12px 20px; display: flex; justify-content: space-between;
  align-items: center; z-index: 50;
}
.nav-btn {
  padding: 10px 24px; border: none; border-radius: 30px;
  font-size: 15px; font-weight: 700; font-family: inherit;
  cursor: pointer; transition: all 0.2s;
}
.nav-btn.prev { background: #EEE; color: var(--text); }
.nav-btn.next { background: var(--primary); color: white; box-shadow: 0 2px 10px rgba(45,90,142,0.3); }
.nav-btn:hover { transform: translateY(-2px); }
.nav-btn:disabled { opacity: 0.3; cursor: default; transform: none; }
.nav-page { font-size: 13px; color: var(--text-light); font-weight: 700; }

.toc { display: grid; gap: 12px; margin-top: 20px; }
.toc-item {
  display: flex; align-items: center; gap: 14px; padding: 16px;
  background: white; border-radius: 12px; border: 2px solid #EEE;
  cursor: pointer; transition: all 0.3s;
}
.toc-item:hover { border-color: var(--primary-light); transform: translateX(4px); }
.toc-num {
  width: 36px; height: 36px; border-radius: 50%; background: var(--primary);
  color: white; display: flex; align-items: center; justify-content: center;
  font-weight: 900; font-size: 16px; flex-shrink: 0;
}
.toc-text { font-size: 15px; font-weight: 700; }

.ending { text-align: center; padding: 40px 20px; }
.ending-icon { font-size: 80px; margin-bottom: 16px; }
.ending-title { font-size: 28px; font-weight: 900; color: var(--primary); margin-bottom: 12px; }
.ending-msg { font-size: 16px; color: var(--text-light); line-height: 1.8; }

.certificate {
  background: linear-gradient(135deg, #FFF8E1, #FFECB3);
  border: 3px solid var(--warm); border-radius: 16px;
  padding: 30px; margin: 30px auto; max-width: 500px;
}
.certificate-title { font-size: 22px; font-weight: 900; color: var(--warm); }
.certificate-body { font-size: 14px; margin-top: 12px; line-height: 1.8; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes bounceIn { 0% { transform: scale(0); } 60% { transform: scale(1.1); } 100% { transform: scale(1); } }
@keyframes panelIn { to { opacity: 1; transform: translateY(0); } }
@keyframes pulse { 0%, 100% { box-shadow: 0 4px 20px rgba(45,90,142,0.4); } 50% { box-shadow: 0 4px 30px rgba(45,90,142,0.7); } }
@keyframes gagPop { 0% { transform: scale(0.5) rotate(-5deg); opacity: 0; } 50% { transform: scale(1.1) rotate(2deg); } 100% { transform: scale(1) rotate(0); } }
@keyframes shiinFade { 0% { opacity: 0; letter-spacing: 2px; } 100% { opacity: 1; letter-spacing: 12px; } }

@media (max-width: 600px) {
  .speech-avatar { width: 44px; height: 44px; font-size: 22px; }
  .speech-bubble { font-size: 13px; }
  .gag-text { font-size: 17px; }
}
</style>
</head>
<body>

<!-- TITLE -->
<div class="title-screen" id="titleScreen">
  <div class="title-badge">訪問介護 法定研修</div>
  <div class="title-main">笑って学ぼう！💥<br>${theme.title}</div>
  <div class="title-sub">${theme.subtitle}<br>※ ギャグのクオリティは保証しません</div>
  <div class="title-characters">
    <div class="title-char">
      <div class="title-char-icon" style="background:#FFF3E0;">🧔</div>
      <div class="title-char-name">ダジャレ所長<br>（おやじ先生）</div>
    </div>
    <div class="title-char">
      <div class="title-char-icon" style="background:#E3F2FD;">👩</div>
      <div class="title-char-name">新人ヘルパー<br>さくらさん</div>
    </div>
    <div class="title-char">
      <div class="title-char-icon" style="background:#F3E5F5;">👩‍🦰</div>
      <div class="title-char-name">ツッコミ担当<br>先輩みさきさん</div>
    </div>
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
let currentPage = 0;
const totalPages = ${totalPages};

function startTraining() {
  document.getElementById('titleScreen').style.display = 'none';
  document.getElementById('progressBar').style.display = 'block';
  document.getElementById('navBar').style.display = 'flex';
  currentPage = 1;
  showPage(currentPage);
}

function showPage(n) {
  document.querySelectorAll('.page').forEach(p => { p.classList.remove('active'); });
  const page = document.getElementById('page' + n);
  if (page) {
    page.classList.add('active');
    page.querySelectorAll('.manga-panel').forEach(p => {
      p.style.animation = 'none';
      p.offsetHeight;
      p.style.animation = '';
    });
  }
  document.getElementById('prevBtn').disabled = (n <= 1);
  document.getElementById('nextBtn').textContent = (n >= totalPages) ? '🎉 完了！' : '次へ ▶';
  document.getElementById('pageNum').textContent = n + ' / ' + totalPages;
  document.getElementById('progressFill').style.width = ((n / totalPages) * 100) + '%';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nextPage() {
  if (currentPage < totalPages) { currentPage++; showPage(currentPage); }
}

function prevPage() {
  if (currentPage > 1) { currentPage--; showPage(currentPage); }
}

function goToPage(n) { currentPage = n; showPage(n); }

function checkQuiz(btn, isCorrect) {
  const quizBox = btn.closest('.quiz-box');
  const options = quizBox.querySelectorAll('.quiz-option');
  options.forEach(o => { o.disabled = true; o.style.pointerEvents = 'none'; });
  if (isCorrect) {
    btn.classList.add('correct');
    const fb = quizBox.querySelector('.quiz-feedback');
    if (fb) { fb.classList.add('show'); fb.style.background = '#E8F5E9'; }
  } else {
    btn.classList.add('wrong');
    options.forEach(o => { if (o.getAttribute('onclick') && o.getAttribute('onclick').includes('true')) o.classList.add('correct'); });
    const fb = quizBox.querySelector('.quiz-feedback');
    if (fb) { fb.classList.add('show'); fb.style.background = '#FFEBEE'; }
  }
}
</script>
</body>
</html>`;
}

// ===== メイン処理 =====
async function main() {
  console.log('法定研修コンテンツの自動生成を開始します...');

  if (!fs.existsSync(TRAININGS_DIR)) {
    fs.mkdirSync(TRAININGS_DIR, { recursive: true });
  }

  const generatedIds = getGeneratedIds();
  const theme = pickTheme(generatedIds);

  if (!theme) {
    console.log('スキップ: 全テーマ生成済み');
    return;
  }

  const outputFile = path.join(TRAININGS_DIR, `${theme.id}.html`);
  if (fs.existsSync(outputFile)) {
    console.log(`スキップ: ${theme.id}.html は既に存在します`);
    return;
  }

  console.log(`テーマ: ${theme.title}（ID: ${theme.id}）`);

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY が設定されていません。');
    process.exit(1);
  }

  const trainingData = await generateTrainingContent(theme);
  console.log(`生成完了: ${trainingData.pages.length} ページ`);

  const fullHTML = buildTrainingHTML(theme, trainingData);
  fs.writeFileSync(outputFile, fullHTML, 'utf-8');
  console.log(`ファイル作成: trainings/${theme.id}.html`);

  // trainings.json 更新
  let trainings = [];
  if (fs.existsSync(TRAININGS_JSON)) {
    trainings = JSON.parse(fs.readFileSync(TRAININGS_JSON, 'utf-8'));
  }

  const today = getToday();
  trainings.push({
    id: theme.id,
    title: theme.title,
    subtitle: theme.subtitle,
    icon: theme.icon,
    description: theme.description,
    file: `${theme.id}.html`,
    date: today,
  });

  fs.writeFileSync(TRAININGS_JSON, JSON.stringify(trainings, null, 2), 'utf-8');
  console.log('trainings.json を更新しました。');
  console.log(`生成済みテーマ数: ${trainings.length} / ${TRAINING_THEMES.length}`);
  console.log('完了!');
}

main().catch(err => {
  console.error('エラーが発生しました:', err.message);
  process.exit(1);
});
