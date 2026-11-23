// Netlify Function: AI proxy for "مختبر الذكاء الاصطناعي".
// The Anthropic API key lives ONLY in the Netlify environment variable ANTHROPIC_API_KEY.
// The page never sees it, and the function builds the prompts itself, so the endpoint
// can only be used for the lab's three tasks (transform / khalid / eval).

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const MAX_PER_10MIN = 60;            // per IP, best effort
const hits = new Map();

const T_PROMPT=(note)=>`أنت «المحوِّل الذكي»، مستشار تربوي خبير في القيادة المدرسية والذكاء العاطفي في مدارس دولة قطر.
مهمتك: (1) تصنيف ملاحظة المنسق على مصفوفة أيزنهاور حيث الأهمية = أثرها على تعلّم الطلبة، والإلحاح = حاجتها لتدخل قبل الحصة القادمة؛ (2) تحويل ملاحظة قالها منسق لمعلم بعد زيارة صفية (قد تكون نقدًا قاسيًا أو عامة أو باللهجة العامية) إلى تغذية راجعة بنّاءة ببُعد إنساني.
القواعد:
- عربية فصحى سهلة ودافئة تُقرأ بصوت عالٍ، بلا رموز أو تنسيق.
- لا تذكر أسماء أشخاص. لا تخترع تفاصيل دقيقة غير موجودة؛ إن احتجت تفصيلًا فاجعله عامًا ومعقولًا.
- الرسالة المنطوقة (feed) بين 55 و80 كلمة: تبدأ بنقطة قوة حقيقية، ثم تصف سلوكًا محددًا بحياد، ثم أثره على تعلّم الطلبة، ثم تقترح خطوة عملية واحدة وتعرض المساعدة، وتنتهي بسؤال تشاركي.
- إن لم تكن الملاحظة متعلقة بالتدريس فحوّلها بأفضل ما يمكن في سياق تربوي.
أعد JSON فقط بهذا الشكل دون أي نص آخر:
{"q":رقم المربع في مصفوفة أيزنهاور (1 = مهم وعاجل، 2 = مهم غير عاجل، 3 = عاجل غير مهم، 4 = غير مهم ولا عاجل),"decision":"قدِّمها الآن | خطِّط لها | نبِّه بلطف | تجاوزها","reason":"جملة واحدة تبرر التصنيف","feed":"الرسالة كاملة بالفصحى","spoken":"الرسالة نفسها بلهجة خليجية قطرية مهذبة ودافئة كما يقولها منسق قطري لزميله، بلا رموز","keys":["مفتاح ذكاء عاطفي مستخدم","…"],"why":"جملة واحدة: لماذا كانت الصياغة الأصلية مؤذية أو غير مفيدة"}

الملاحظة الأصلية: «${note}»`;

const K_PROMPT=(mood, transcript)=>`أنت تمثّل دور «أ. خالد»، معلم قطري خبرته 12 عامًا، مخلص ومجتهد لكنه حساس تجاه النقد ويدافع عن نفسه في البداية. الموقف: زاره منسق المادة اليوم في حصة ولاحظ أن الطلبة لم يتفاعلوا. من يحادثك هو المنسق (عضو في لجنة تدريبية يتدرّب على التغذية الراجعة).
طريقة الرد: جملة أو جملتان قصيرتان (لا تزيد عن 30 كلمة) بلهجة خليجية قطرية مهذبة ومبسطة يفهمها الجميع، طبيعية تصلح للنطق، بلا رموز.
السلوك:
- إن استخدم المنسق أحكامًا عامة أو لومًا أو مقارنة أو أوامر ← ازدد دفاعية وبرّر (الصف صعب، المنهج طويل، الوقت ضيق، الطلاب مستواهم ضعيف...).
- إن أظهر تقديرًا صادقًا وتعاطفًا، ووصف سلوكًا محددًا، وفصل السلوك عن شخصك، وسألك عن رأيك، واقترح خطوة عملية مع عرض المساعدة ← لِن تدريجيًا حتى تتقبل وتشكره.
- لا تلِن بسرعة غير واقعية، ولا تخرج عن الدور، ولا تذكر أنك ذكاء اصطناعي.
مؤشر تقبّلك الحالي: ${mood} من 100.
المحادثة حتى الآن:
${transcript}
أعد JSON فقط دون أي نص آخر:
{"reply":"رد خالد","mood":رقم من 0 إلى 100 يمثل تقبّلك بعد آخر جملة للمنسق,"signal":"كلمتان أو ثلاث: ما الذي أثّر فيك (إيجابًا أو سلبًا) في آخر جملة للمنسق"}`;

const E_PROMPT=(transcript)=>`أنت مدرب خبير في القيادة التربوية والذكاء العاطفي. قيّم أداء «المنسق» في حوار التغذية الراجعة التالي مع معلم دفاعي اسمه خالد. كن عادلًا وصارمًا: الحوار القصير جدًا أو الخالي من خطوة عملية يحصل على درجات منخفضة.
المحادثة:
${transcript}
أعد JSON فقط دون أي نص آخر:
{"criteria":[{"name":"التعاطف والتقدير","score":رقم 0-10,"note":"جملة قصيرة"},{"name":"تحديد السلوك بدقة","score":0-10,"note":"…"},{"name":"فصل السلوك عن الشخص","score":0-10,"note":"…"},{"name":"الخطوة العملية وعرض المساعدة","score":0-10,"note":"…"}],"overall":رقم من 10 بخانة عشرية واحدة,"strength":"جملة واحدة عن أبرز نقطة قوة","advice":"نصيحة واحدة عملية","verdict":"جملتان قصيرتان بلهجة خليجية قطرية مهذبة تُقرآن بصوت عالٍ تلخصان التقييم والدرجة"}`;

const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").slice(0, n);
function transcriptOf(hist) {
  if (!Array.isArray(hist)) return "";
  return hist.slice(-16).map(h => (h && h.who === "k" ? "خالد: " : "المنسق: ") + clean(h && h.text, 600)).join("\n");
}
const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

export default async (req, context) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let body; try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const key = process.env.ANTHROPIC_API_KEY;
  if (body.kind === "ping") return json({ ok: true, configured: !!key });
  if (!key) return json({ error: "ANTHROPIC_API_KEY is not set" }, 503);

  const ip = (context && context.ip) || req.headers.get("x-nf-client-connection-ip") || "x";
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < 600000);
  if (arr.length >= MAX_PER_10MIN) return json({ error: "rate limited" }, 429);
  arr.push(now); hits.set(ip, arr);

  const d = body.data || {};
  let prompt, maxTok = 700;
  if (body.kind === "transform") { const note = clean(d.note, 800).trim(); if (!note) return json({ error: "empty" }, 400); prompt = T_PROMPT(note); maxTok = 900; }
  else if (body.kind === "khalid") { prompt = K_PROMPT(Math.max(0, Math.min(100, Number(d.mood) || 22)), transcriptOf(d.hist)); maxTok = 300; }
  else if (body.kind === "eval") { prompt = E_PROMPT(transcriptOf(d.hist)); maxTok = 800; }
  else return json({ error: "unknown kind" }, 400);

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTok, messages: [{ role: "user", content: prompt }] })
    });
    const j = await r.json();
    if (!r.ok) return json({ error: (j && j.error && j.error.message) || ("anthropic " + r.status) }, 502);
    return json({ text: (j.content || []).map(c => c.text || "").join("") });
  } catch (e) {
    return json({ error: "upstream: " + e.message }, 502);
  }
};
