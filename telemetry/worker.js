/**
 * タバネル テレメトリ受け皿 (Cloudflare Worker + D1)
 *
 * 受け取るのは「同意した利用者」からの匿名データのみ:
 *   - 匿名ID(ランダム英数字・個人と紐づかない)
 *   - 週(YYYY-Www) / 職種カテゴリ(選択式)
 *   - 登録済みサービスメニューの品名と価格
 *   - 直近の案件数・売上の帯域(具体額ではない)
 * 顧客の氏名・電話・住所・案件の自由入力テキストは、送信側の設計に含まれない。
 */

const ALLOWED_ORIGIN = 'https://dbtg-mgn.github.io';
const OCCUPATIONS = ['清掃・ハウスクリーニング','修理・リフォーム','便利屋・代行','造園・外構','美容・マッサージ・整体','トレーナー・教室','配送・運搬','その他'];
const JOB_BANDS = ['0','1-4','5-9','10-19','20-49','50+'];
const SALES_BANDS = ['0','~10万','10-30万','30-100万','100万+'];

const cors = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...cors } });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (url.pathname === '/v1/ping' && req.method === 'POST') {
      let body;
      try {
        const text = await req.text();
        if (text.length > 10000) return json({ ok: false }, 413);
        body = JSON.parse(text);
      } catch (e) { return json({ ok: false }, 400); }

      const id = String(body.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
      const week = String(body.week || '');
      if (!id || !/^\d{4}-W\d{2}$/.test(week)) return json({ ok: false }, 400);

      const occ = OCCUPATIONS.includes(body.occ) ? body.occ : '未設定';
      const jobs = JOB_BANDS.includes(body.jobs) ? body.jobs : '';
      const sales = SALES_BANDS.includes(body.sales) ? body.sales : '';

      await env.DB.prepare(
        'INSERT OR REPLACE INTO pings(id,week,occ,jobs_band,sales_band,ts) VALUES(?,?,?,?,?,?)'
      ).bind(id, week, occ, jobs, sales, Date.now()).run();

      await env.DB.prepare('DELETE FROM menu_items WHERE id=? AND week=?').bind(id, week).run();
      const items = Array.isArray(body.menu) ? body.menu.slice(0, 50) : [];
      for (const m of items) {
        const name = String((m && m.n) || '').slice(0, 40);
        const price = Math.max(0, Math.min(100000000, Number(m && m.p) || 0));
        if (name) {
          await env.DB.prepare('INSERT INTO menu_items(id,week,name,price) VALUES(?,?,?,?)')
            .bind(id, week, name, price).run();
        }
      }
      return json({ ok: true });
    }

    if (url.pathname === '/dash') {
      if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
        return new Response('Not found', { status: 404 });
      }
      const weekly = (await env.DB.prepare(
        'SELECT week, COUNT(DISTINCT id) AS n FROM pings GROUP BY week ORDER BY week DESC LIMIT 12'
      ).all()).results;
      const retention = (await env.DB.prepare(
        'SELECT weeks, COUNT(*) AS users FROM (SELECT id, COUNT(DISTINCT week) AS weeks FROM pings GROUP BY id) GROUP BY weeks ORDER BY weeks'
      ).all()).results;
      const occ = (await env.DB.prepare(
        'SELECT occ, COUNT(DISTINCT id) AS n FROM pings GROUP BY occ ORDER BY n DESC'
      ).all()).results;
      const prices = (await env.DB.prepare(
        `SELECT name, COUNT(*) AS n, MIN(price) AS min_p, CAST(AVG(price) AS INTEGER) AS avg_p, MAX(price) AS max_p
         FROM menu_items WHERE week=(SELECT MAX(week) FROM menu_items) GROUP BY name ORDER BY n DESC LIMIT 30`
      ).all()).results;
      const bands = (await env.DB.prepare(
        `SELECT sales_band, COUNT(DISTINCT id) AS n FROM pings
         WHERE week=(SELECT MAX(week) FROM pings) AND sales_band!='' GROUP BY sales_band`
      ).all()).results;

      const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
      const yen = n => '¥' + Number(n || 0).toLocaleString('ja-JP');
      const table = (rows, cols, render) => rows.length
        ? `<table><thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map(render).join('')}</tbody></table>`
        : '<p class="empty">まだデータがありません</p>';

      const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>タバネル 利用統計</title>
<style>
body{font-family:-apple-system,"Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif;background:#f2f5f3;color:#1e2a24;margin:0;padding:20px;line-height:1.6}
.wrap{max-width:860px;margin:0 auto}
h1{font-size:20px}h2{font-size:14px;color:#5f6e66;margin:26px 0 8px;letter-spacing:.06em}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;font-size:13.5px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
th,td{padding:9px 12px;text-align:left;border-bottom:1px solid #e1e7e3}
th{background:#e6f1ea;color:#1f5c3d;font-size:12px}
td.num{text-align:right;font-variant-numeric:tabular-nums}
.empty{color:#5f6e66;font-size:13px;background:#fff;padding:14px;border-radius:10px}
.note{font-size:12px;color:#5f6e66;margin-top:26px}
</style></head><body><div class="wrap">
<h1>タバネル 利用統計ダッシュボード</h1>
<h2>週ごとのアクティブ利用者数（匿名ID単位）</h2>
${table(weekly, ['週','人数'], r=>`<tr><td>${esc(r.week)}</td><td class="num">${r.n}</td></tr>`)}
<h2>継続利用（何週使っている人が何人いるか）</h2>
${table(retention, ['利用週数','人数'], r=>`<tr><td>${r.weeks}週</td><td class="num">${r.users}</td></tr>`)}
<h2>職種の分布</h2>
${table(occ, ['職種','人数'], r=>`<tr><td>${esc(r.occ)}</td><td class="num">${r.n}</td></tr>`)}
<h2>サービス単価の相場（最新週・登録メニューより）</h2>
${table(prices, ['サービス名','件数','最低','平均','最高'], r=>`<tr><td>${esc(r.name)}</td><td class="num">${r.n}</td><td class="num">${yen(r.min_p)}</td><td class="num">${yen(r.avg_p)}</td><td class="num">${yen(r.max_p)}</td></tr>`)}
<h2>月商の分布（最新週・帯域）</h2>
${table(bands, ['月商帯','人数'], r=>`<tr><td>${esc(r.sales_band)}</td><td class="num">${r.n}</td></tr>`)}
<p class="note">データは利用者の同意に基づく匿名統計のみ。個人・顧客を特定できる情報は含まれません。</p>
</div></body></html>`;
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    return new Response('genbanote-telemetry', { status: 200 });
  }
};
