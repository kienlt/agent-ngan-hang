import { createServer } from "http";
import { readFileSync } from "fs";
import path from "path";
import { tinhLai } from "./lai-suat.js";
import { GoogleGenAI } from "@google/genai";

const data = JSON.parse(readFileSync(path.join(process.cwd(), "lai-suat.json"), "utf-8"));
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

async function hieuCauKhachAI(cau: string): Promise<{ soTien: number; coGT: boolean }> {
  if (!process.env.GEMINI_API_KEY) return hieuCauKhachCu(cau);
  try {
    const prompt = `Bạn là nhân viên ngân hàng Tân Phú. Hãy trích xuất thông tin từ câu hỏi của khách thành JSON duy nhất, không giải thích thêm.
Câu hỏi: "${cau}"
Trả về đúng dạng: {"soTien": 123, "coGT": true}
Quy tắc:
- soTien là số tiền gửi bằng VNĐ, số nguyên. Ví dụ: "700 triệu" = 700000000, "1 tỷ" = 1000000000, "1 tỷ 200 triệu" = 1200000000, "500 củ" = 500000000, "năm trăm triệu" = 500000000.
- coGT = true nếu khách có người giới thiệu, có coupon, có người quen giới thiệu. coGT = false nếu khách nói không có ai, đi một mình, tự đến, không có coupon.
- Nếu không thấy số tiền thì soTien = 0.`;
    const result = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
    const text = result.text || "";
    const jsonStr = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const parsed = JSON.parse(jsonStr);
    return { soTien: Number(parsed.soTien) || 0, coGT: !!parsed.coGT };
  } catch (e) {
    return hieuCauKhachCu(cau);
  }
}

const TU_SO: any = { mot: 1, hai: 2, ba: 3, bon: 4, nam: 5, sau: 6, bay: 7, tam: 8, chin: 9, muoi: 10 };
function docSoBangChu(cau: string) {
  let chuan = cau.toLowerCase();
  for (const tu in TU_SO) chuan = chuan.replace(new RegExp("\\b" + tu + "\\b", "g"), String(TU_SO[tu]));
  const parts = chuan.match(/\d+(?:[.,]\d+)?|tram|muoi|nghin|trieu|ty|ti/g);
  if (!parts) return 0;
  let tong = 0; let phanTram = 0; let phanMuoi = 0; let soHienTai = 0; let coSo = false; let coDonVi = false;
  for (const p of parts) {
    if (/^\d/.test(p)) { soHienTai = Number(p.replace(",", ".")); coSo = true; }
    else if (p === "tram") { phanTram = (soHienTai || 1) * 100; soHienTai = 0; }
    else if (p === "muoi") { phanMuoi = (soHienTai || 1) * 10; soHienTai = 0; }
    else if (p === "trieu" || p === "ty" || p === "ti" || p === "nghin") {
      coDonVi = true;
      const donVi = p === "trieu" ? 1000000 : p === "nghin" ? 1000 : 1000000000;
      const nhom = phanTram + phanMuoi + (soHienTai || (phanTram === 0 && phanMuoi === 0 ? 1 : 0));
      tong += nhom * donVi; phanTram = 0; phanMuoi = 0; soHienTai = 0;
    }
  }
  if (!coDonVi && coSo) {
    if (soHienTai >= 1000 || phanTram >= 1000) tong = phanTram + phanMuoi + soHienTai;
    else tong = (phanTram + phanMuoi + soHienTai) * 1000000;
  }
  return tong;
}
function hieuCauKhachCu(cau: string) {
  const cauThap = cau.toLowerCase();
  let coGT = false;
  const coChuKhong = cauThap.includes("khong") || cauThap.includes("k co") || cauThap.includes("khong co ai") || cauThap.includes("tu den") || cauThap.includes("mot minh");
  if (coChuKhong) coGT = false;
  else if (cauThap.includes("gioi thieu") || cauThap.includes("coupon") || cauThap.includes("co nguoi")) coGT = true;
  const coCauPhucTap = cauThap.includes("tram") || cauThap.includes("muoi") || /\b(mot|hai|ba|bon|nam|sau|bay|tam|chin)\b/.test(cauThap) || (cauThap.includes("ty") && cauThap.includes("trieu"));
  let soTien = 0;
  if (coCauPhucTap) soTien = docSoBangChu(cauThap);
  else {
    const timTy = cauThap.match(/([\d.,]+)\s*(ty|ti)/);
    const timTrieu = cauThap.match(/([\d.,]+)\s*(trieu|tr)/);
    const timSoTran = cauThap.match(/(\d{6,})/);
    if (timTy) soTien = Number(timTy[1].replace(",", ".")) * 1000000000;
    else if (timTrieu) soTien = Number(timTrieu[1].replace(",", ".")) * 1000000;
    else if (timSoTran) soTien = Number(timSoTran[1]);
    if (soTien === 0) soTien = docSoBangChu(cauThap);
  }
  return { soTien, coGT };
}

// --- GUI TIN NHAN VE TELEGRAM ---
async function guiTelegram(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

const server = createServer(async (req, res) => {
  // --- DUONG DAN MOI CHO TELEGRAM ---
  if (req.url === "/telegram" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const update = JSON.parse(body);
        const msg = update.message;
        if (!msg || !msg.text) { res.writeHead(200); res.end("ok"); return; }
        const chatId = msg.chat.id;
        const cau = msg.text;

        if (cau === "/start") {
          await guiTelegram(chatId, "Chao chi! Em la Agent Tinh Lai Tan Phu. Chi cu nhan nhu: 'Gui 700 trieu co nguoi gioi thieu thi duoc bao nhieu?'");
          res.writeHead(200); res.end("ok"); return;
        }

        const { soTien, coGT } = await hieuCauKhachAI(cau);
        if (soTien === 0) {
          await guiTelegram(chatId, "Em chua hieu so tien. Chi ghi lai giup em: 'Gui 700 trieu co nguoi gioi thieu'");
        } else {
          const kq = tinhLai(soTien, coGT);
          await guiTelegram(chatId, `Da, chi gui ${soTien.toLocaleString("vi-VN")}d, ${coGT ? "co coupon gioi thieu" : "khong co coupon"} thi lai suat la ${kq.laiSuat}%/nam.\nTien lai 1 nam cua chi la: ${kq.tienLai.toLocaleString("vi-VN")}d a.`);
        }
      } catch (e) { console.log("Telegram loi:", e); }
      res.writeHead(200); res.end("ok");
    });
    return;
  }

  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(` <h1>Agent Tinh Lai - Tan Phu</h1> <p>Lai cong bo: ${data.kyHan12Thang.congBo}% - Coupon: ${data.kyHan12Thang.couponGioiThieu}%</p> <h2>Cach 1: Bam nut (Buoi 3)</h2> <form action="/tinh" method="GET"> <label>So tien gui: <input type="number" name="tien" value="500000000" /></label><br><br> <label><input type="checkbox" name="gt" value="1" /> Co nguoi gioi thieu</label><br><br> <button>Tinh lai</button> </form> <hr> <h2>Cach 2: Hoi nhu nguoi that (Buoi 4 - MOI, co AI that)</h2> <form action="/hoi" method="GET"> <input type="text" name="cau" style="width:350px" placeholder="VD: Gui 1 ty 200 trieu co nguoi quen gioi thieu thi sao?" /> <button>Hoi Agent</button> </form> <hr><p>Telegram Bot: @Kent204_bot - Ban co the hoi truc tiep tren Telegram!</p> `);
    return;
  }
  if (req.url?.startsWith("/tinh")) {
    const url = new URL(req.url, "http://localhost");
    const tien = Number(url.searchParams.get("tien") || 0);
    const coGT = url.searchParams.get("gt") === "1";
    const kq = tinhLai(tien, coGT);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<h1>Ket qua</h1><p>Gui: ${tien.toLocaleString("vi-VN")}d</p><p>Lai suat: ${kq.laiSuat}%/nam</p><p>Tien lai: ${kq.tienLai.toLocaleString("vi-VN")}d</p><p>${kq.ghiChu}</p><a href="/">Tinh lai</a>`);
    return;
  }
  if (req.url?.startsWith("/hoi")) {
    const url = new URL(req.url, "http://localhost");
    const cau = url.searchParams.get("cau") || "";
    const { soTien, coGT } = await hieuCauKhachAI(cau);
    if (soTien === 0) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<h1>Agent tra loi</h1><p>Em chua hieu so tien. Chi ghi lai giup em: "Gui 700 trieu co nguoi gioi thieu"</p><a href="/">Hoi lai</a>`);
      return;
    }
    const kq = tinhLai(soTien, coGT);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(` <h1>Agent tra loi (AI that)</h1> <p><b>Khach hoi:</b> ${cau}</p> <p>Da, chi gui ${soTien.toLocaleString("vi-VN")}d, ${coGT ? "co coupon gioi thieu" : "khong co coupon"} thi lai suat la ${kq.laiSuat}%/nam.</p> <p><b>Tien lai 1 nam cua chi la: ${kq.tienLai.toLocaleString("vi-VN")}d a.</b></p> <a href="/">Hoi cau khac</a> `);
    return;
  }
});

if (process.env.VERCEL !== "1") {
  const PORT = Number(process.env.PORT || 3000);
  server.listen(PORT, () => { console.log(`Agent dang chay o port ${PORT}`); });
}
export default (req: any, res: any) => { server.emit("request", req, res); };