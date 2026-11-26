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
    /*let cauChuan = cau.toLowerCase();
    cauChuan = cauChuan.replace(/tỏi|toi/g, "ty");
    cauChuan = cauChuan.replace(/\bcu\b|củ/g, "trieu");
    cauChuan = cauChuan.replace(/bốn|bon/g, "4");
    cauChuan = cauChuan.replace(/năm|nam/g, "5");
*/
   const prompt = `Ban la nhan vien ngan hang, rat gioi hieu tieng Viet noi chuyen hang ngay.
Cau hoi: "${cau}"

NHIEM VU CUA BAN: Tu sua loi go, sai dau, viet tat truoc khi tinh.
QUY TAC HIEU TIENG LONG:
- "toi / toi / tới / tỏi / ty / ti / tỷ" sau 1 con so deu la TY, vi du "2 toi" = 2 ty, "2 tới tôi" = 2 ty
- "tr / trieu / củ / cu" deu la TRIEU, vi du "200tr" = 200 trieu
- "gởi / gửi / gui" deu la GUI
- "cong them / them / cong / voi" deu la CONG
- "co nguoi gioi thieu / co nguoi quen / co coupon" deu la CO GIOI THIEU
- "tôi" dung 1 minh thi la TOI (nguoi noi), khong phai TY. Chi khi "tôi" dung sau so tien moi la TY.

QUAN TRONG NHAT: Neu co 2 so tien tro len, PHAI CONG HET LAI.
Vi du: "200tr cong them 2 toi" = 200000000 + 2000000000 = 2200000000
Tra ve dung dang: {"soTien": 123, "coGT": true}
- soTien la TONG, bang VND.
- coGT = true neu co nguoi gioi thieu. coGT = false neu khong co ai.
- Neu khong thay so tien thi soTien = 0.`;

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
  let chuan = cau.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  for (const tu in TU_SO) chuan = chuan.replace(new RegExp("\\b" + tu + "\\b", "g"), String(TU_SO[tu]));
  const parts = chuan.match(/\d+(?:[.,]\d+)?|\b(?:tram|muoi|nghin|ngan|trieu|ty|ti|toi|tr)\b|(?<=\d)(?:trieu|tr|ty|ti|toi)\b/g);
  if (!parts) return 0;
  let tong = 0;
  let phanTram = 0;
  let phanMuoi = 0;
  let soHienTai = 0;
  let coSo = false;
  let coSoHienTai = false;
  let coDonVi = false;
  for (const p of parts) {
    if (/^\d/.test(p)) { soHienTai = Number(p.replace(",", ".")); coSo = true; coSoHienTai = true; }
    else if (p === "tram") { phanTram = (soHienTai || 1) * 100; soHienTai = 0; }
    else if (p === "muoi") { phanMuoi = (soHienTai || 1) * 10; soHienTai = 0; }
    else if (p === "trieu" || p === "tr" || p === "ty" || p === "ti" || p === "toi" || p === "nghin" || p === "ngan") {
      if (p === "toi" && !coSoHienTai) continue;
      coDonVi = true;
      const donVi = p === "trieu" || p === "tr" ? 1000000 : p === "nghin" || p === "ngan" ? 1000 : 1000000000;
      const nhom = phanTram + phanMuoi + (soHienTai || (phanTram === 0 && phanMuoi === 0 ? 1 : 0));
      tong += nhom * donVi;
      phanTram = 0; phanMuoi = 0; soHienTai = 0;
      coSoHienTai = false;
    }
  }
  if (!coDonVi && coSo) {
    if (soHienTai >= 1000 || phanTram >= 1000) tong = phanTram + phanMuoi + soHienTai;
    else tong = (phanTram + phanMuoi + soHienTai) * 1000000;
  }
  return tong;
}

function hieuCauKhachCu(cau: string) {
  const cauThap = cau.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  let coGT = false;
  const coChuKhong = cauThap.includes("khong") || cauThap.includes("k co") || cauThap.includes("khong co ai") || cauThap.includes("tu den") || cauThap.includes("mot minh");
  if (coChuKhong) coGT = false;
  else if (cauThap.includes("gioi thieu") || cauThap.includes("coupon") || cauThap.includes("co nguoi")) coGT = true;
  const soTien = docSoBangChu(cauThap);
  return { soTien, coGT };
}

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
          await guiTelegram(chatId, "Da, em chao chi a! 👋\nEm la Agent Tinh Lai cua Tan Phu.\nChi cu nhan nhu dang noi chuyen voi em vay, vi du:\n'Gui 200 trieu cong them 2 toi co nguoi gioi thieu thi duoc bao nhieu?'\nEm tinh cho chi lien a!");
          res.writeHead(200); res.end("ok"); return;
        }
        const { soTien, coGT } = await hieuCauKhachAI(cau);
        if (soTien === 0) {
          await guiTelegram(chatId, "Em chua hieu so tien. Chi ghi lai giup em: 'Gui 700 trieu co nguoi gioi thieu'");
        } else {
          const kq = tinhLai(soTien, coGT);
          await guiTelegram(chatId, `Da, em tinh cho chi roi a! 📝\nChi gui: ${soTien.toLocaleString("vi-VN")}d\nLai suat: ${kq.laiSuat}%/nam 📈\nTien lai 1 nam: ${kq.tienLai.toLocaleString("vi-VN")}d 💰\n\n${coGT ? "Da co coupon gioi thieu 2.6% roi chi a." : "Chua co coupon chi a. Neu chi co nguoi gioi thieu, chi se duoc them 2.6% nua do chi."}\nChi co muon em tinh them truong hop khac cho chi khong a?`);
        }
      } catch (e) { console.log("Telegram loi:", e); }
      res.writeHead(200); res.end("ok");
    });
    return;
  }

  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <h1>Agent Tinh Lai - Tan Phu</h1>
      <p>Lai cong bo: ${data.kyHan12Thang.congBo}% - Coupon: ${data.kyHan12Thang.couponGioiThieu}%</p>
      <h2>Cach 1: Bam nut (Buoi 3)</h2>
      <form action="/tinh" method="GET">
        <label>So tien gui: <input type="number" name="tien" value="500000000" /></label><br><br>
        <label><input type="checkbox" name="gt" value="1" /> Co nguoi gioi thieu</label><br><br>
        <button>Tinh lai</button>
      </form>
      <hr>
      <h2>Cach 2: Hoi nhu nguoi that (Buoi 4 - MOI, co AI that)</h2>
      <form action="/hoi" method="GET">
        <input type="text" name="cau" style="width:350px" placeholder="VD: Gui 1 ty 200 trieu co nguoi quen gioi thieu thi sao?" />
        <button>Hoi Agent</button>
      </form>
      <hr><p>Telegram Bot: @Kent204_bot - Ban co the hoi truc tiep tren Telegram!</p>
    `);
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
    res.end(`
      <h1>Agent tra loi (AI that)</h1>
      <p><b>Khach hoi:</b> ${cau}</p>
      <p>Da, em tinh cho chi roi a! 📝</p>
      <p>Chi gui: ${soTien.toLocaleString("vi-VN")}d<br>Lai suat: ${kq.laiSuat}%/nam 📈<br><b>Tien lai 1 nam: ${kq.tienLai.toLocaleString("vi-VN")}d 💰</b></p>
      <p>${coGT ? "Da co coupon gioi thieu 2.6% roi chi a." : "Chua co coupon chi a. Neu chi co nguoi gioi thieu, chi se duoc them 2.6% nua do chi."}</p>
      <a href="/">Hoi cau khac</a>
    `);
    return;
  }
});

if (process.env.VERCEL !== "1") {
  const PORT = Number(process.env.PORT || 3000);
  server.listen(PORT, () => { console.log(`Agent dang chay o port ${PORT}`); });
}

export default (req: any, res: any) => { server.emit("request", req, res); };