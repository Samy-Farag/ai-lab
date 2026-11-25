// Netlify Function: AI proxy for "مختبر الذكاء الاصطناعي".
// The Anthropic API key lives ONLY in the Netlify environment variable ANTHROPIC_API_KEY.
// The page never sees it, and the function builds the prompts itself, so the endpoint
// can only be used for the lab's three tasks (transform / khalid / eval).

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const MAX_PER_10MIN = 60;            // per IP, best effort
const hits = new Map();

const T_PROMPT=(note)=>`أنت «المحوِّل الذكي»: منسق خبير ومدرب في القيادة التربوية والذكاء العاطفي بمدارس دولة قطر. تكتب ما سيقوله منسق حقيقي لمعلم زميل في لقاء ما بعد الزيارة الصفية، انطلاقًا من ملاحظة قالها المنسق بصياغة قاسية أو عامة أو عامية.

الخطوات:
1) حلّل الملاحظة: ما السلوك الصفي المقصود فعلًا؟ (مثل: ضعف المشاركة، سيطرة بعض الطلبة على النقاش، أسئلة مغلقة أو من مستوى التذكّر، إدارة الوقت أو التأخر، ضبط الصف، وضوح الشرح أو سرعته، التمايز ومراعاة الضعاف والمتميزين، التقويم الختامي، وضوح الأهداف ومعايير النجاح، توظيف التقنية، الواجبات، التعامل اللفظي مع الطلبة، تنظيم السبورة...). إن احتوت أكثر من مشكلة فاختر الأعلى أثرًا على التعلّم وأجّل الباقي.
2) صنّفها على مصفوفة أيزنهاور: الأهمية = أثرها على تعلّم الطلبة، الإلحاح = حاجتها لتدخل قبل الحصة القادمة.
3) اكتب تغذية راجعة بنموذج FEED مبنية على هذه الملاحظة تحديدًا:
- f (ركّز): صف السلوك الملاحَظ نفسه وصفًا محايدًا قابلًا للملاحظة (ماذا رأيت أو سمعت، وفي أي جزء من الحصة)، مستمدًا من كلمات الملاحظة، بلا أحكام.
- e1 (تعاطف): تقدير صادق مرتبط بسياق هذه المشكلة، أو تفهّم لصعوبة حقيقية تسببها؛ لا مديح عام.
- e2 (عبّر): الأثر المحدد لهذا السلوك على تعلّم الطلبة.
- d (وجّه): استراتيجية صفية محددة بالاسم تناسب هذه المشكلة بالذات، مع طريقة تطبيقها في جملة (أمثلة للاستئناس لا للتكرار: وقت الانتظار 3–5 ثوانٍ، الأعواد أو الأسماء العشوائية، أدوار المجموعة، فكّر–زاوج–شارك، بطاقة الخروج، معايير النجاح المرئية، المؤقت المرئي، أسئلة متدرجة وفق بلوم، مهام متمايزة بثلاثة مستويات، التعزيز اللفظي المحدد، النمذجة ثم التطبيق الموجّه)، ثم عرض دعم محدد (تخطيط مشترك، حضور جزء من الحصة، زيارة تبادلية لزميل، مشاركة نموذج).
- ask: سؤال تأملي مفتوح يُطرح على المعلم قبل الاقتراح ليشارك رأيه وتفسيره.
قواعد الأسلوب:
- يجب أن تختلف الرسالة جوهريًا باختلاف الملاحظة: السلوك والأثر والاستراتيجية خاصة بها. ممنوع القوالب العامة.
- تجنّب العبارات المستهلكة: «أقدّر جهدك»، «واضح أنك حضّرت جيدًا»، «يسعدني أن أساعدك»، «تعديل بسيط قد يصنع فرقًا كبيرًا»، «ما رأيك أن نجرّب»؛ ونوّع البداية والختام.
- إن كانت الملاحظة إيجابية فعزّزها بدقة واقترح خطوة توسّع.
- لا تخترع أرقامًا أو أسماء أو أحداثًا لم تُذكر؛ يجوز التعميم المعقول (مثل: في نشاط المجموعات).
- feed: الأجزاء الأربعة مدموجة في رسالة طبيعية متصلة (70–100 كلمة) بفصحى سهلة دافئة كما يتحدث زميل لزميل، تتضمن سؤال ask في موضعه، بلا رموز أو تنسيق.
- spoken: المعنى نفسه بلهجة خليجية قطرية مهذبة كما يقولها منسق قطري لزميله.
أعد JSON فقط دون أي نص آخر:
{"topic":"مجال الملاحظة في كلمتين","q":رقم المربع (1 مهم وعاجل، 2 مهم غير عاجل، 3 عاجل غير مهم، 4 غير مهم ولا عاجل),"decision":"قدِّمها الآن | خطِّط لها | نبِّه بلطف | تجاوزها","reason":"جملة واحدة تبرر التصنيف","f":"…","e1":"…","e2":"…","d":"…","ask":"…","feed":"…","spoken":"…","keys":["مفتاح ذكاء عاطفي مستخدم","…"],"why":"جملة واحدة: لماذا كانت الصياغة الأصلية مؤذية أو غير مفيدة"}

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
  if (body.kind === "transform") { const note = clean(d.note, 800).trim(); if (!note) return json({ error: "empty" }, 400); prompt = T_PROMPT(note); maxTok = 1400; }
  else if (body.kind === "khalid") { prompt = K_PROMPT(Math.max(0, Math.min(100, Number(d.mood) || 22)), transcriptOf(d.hist)); maxTok = 300; }
  else if (body.kind === "eval") { prompt = E_PROMPT(transcriptOf(d.hist)); maxTok = 800; }
  else return json({ error: "unknown kind" }, 400);

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTok, temperature: body.kind === "eval" ? 0.3 : body.kind === "khalid" ? 0.8 : 0.9, messages: [{ role: "user", content: prompt }] })
    });
    const j = await r.json();
    if (!r.ok) return json({ error: (j && j.error && j.error.message) || ("anthropic " + r.status) }, 502);
    return json({ text: (j.content || []).map(c => c.text || "").join("") });
  } catch (e) {
    return json({ error: "upstream: " + e.message }, 502);
  }
};
