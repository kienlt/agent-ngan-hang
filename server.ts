import { createServer } from "http";
import { readFileSync } from "fs";
import { tinhLai } from "./lai-suat.js";

const data = JSON.parse(readFileSync("./lai-suat.json", "utf-8"));

// --- NAO AI DON GIAN: Doc cau cua khach, tach ra so tien ---
// --- NAO AI MOI: Biet doc ca SO va CHU ---
const TU_SO: any = {
  mot: 1, hai: 2, ba: 3, bon: 4, nam: 5, sau: 6, bay: 7, tam: 8, chin: 9, muoi: 10
};

function docSoBangChu(cau: string) {
  let chuan = cau.toLowerCase();
  for (const tu in TU_SO) {
    chuan = chuan.replace(new RegExp("\\b" + tu + "\\b", "g"), String(TU_SO[tu]));
  }

  const parts = chuan.match(/\d+(?:[.,]\d+)?|tram|muoi|nghin|trieu|ty|ti/g);
  if (!parts) return 0;

  let tong = 0;
  let phanTram = 0;
  let phanMuoi = 0;
  let soHienTai = 0;
  let coSo = false;
  let coDonVi = false;

  for (const p of parts) {
    if (/^\d/.test(p)) {
      soHienTai = Number(p.replace(",", "."));
      coSo = true;
    } else if (p === "tram") {
      phanTram = (soHienTai || 1) * 100;
      soHienTai = 0;
    } else if (p === "muoi") {
      phanMuoi = (soHienTai || 1) * 10;
      soHienTai = 0;
    } else if (p === "trieu" || p === "ty" || p === "ti" || p === "nghin") {
      coDonVi = true;
      const donVi = p === "trieu" ? 1000000 : p === "nghin" ? 1000 : 1000000000;
      const nhom = phanTram + phanMuoi + (soHienTai || (phanTram === 0 && phanMuoi === 0 ? 1 : 0));
      tong += nhom * donVi;
      phanTram = 0; phanMuoi = 0; soHienTai = 0;
    }
  }

  // SỬA LỖI Ở ĐÂY: Nếu không có đơn vị trieu/ty
  if (!coDonVi && coSo) {
    // Nếu số đã lớn >= 1000 thì nó là số tiền thật, ví dụ 500000000
    // Đừng nhân thêm 1 triệu nữa
    if (soHienTai >= 1000 || phanTram >= 1000) {
      tong = phanTram + phanMuoi + soHienTai;
    } else {
      // Nếu số nhỏ như "9 tram 50" mà không nói trieu, thì mặc định là trieu
      tong = (phanTram + phanMuoi + soHienTai) * 1000000;
    }
  }
  return tong;
}

function hieuCauKhach(cau: string) {
  const cauThap = cau.toLowerCase();

  let coGT = false;
  const coChuKhong = cauThap.includes("khong") || cauThap.includes("k co") || cauThap.includes("khong co ai") || cauThap.includes("tu den") || cauThap.includes("mot minh");
  if (coChuKhong) {
    coGT = false;
  } else if (cauThap.includes("gioi thieu") || cauThap.includes("coupon") || cauThap.includes("co nguoi")) {
    coGT = true;
  }

  // Cách an toàn nhất: Nếu câu có chữ "tram" / "muoi" / chữ số thì dùng docSoBangChu
  // Còn câu chỉ có số đơn giản "700 trieu" thì dùng cách cũ cho chắc
  const coCauPhucTap = cauThap.includes("tram") || cauThap.includes("muoi") || /\b(mot|hai|ba|bon|nam|sau|bay|tam|chin)\b/.test(cauThap) || (cauThap.includes("ty") && cauThap.includes("trieu"));

  let soTien = 0;
  if (coCauPhucTap) {
    soTien = docSoBangChu(cauThap);
  } else {
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





const server = createServer((req, res) => {
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
      <h2>Cach 2: Hoi nhu nguoi that (Buoi 4 - MOI)</h2>
      <form action="/hoi" method="GET">
        <input type="text" name="cau" style="width:350px" placeholder="VD: Gui 700 trieu co nguoi gioi thieu thi duoc bao nhieu?" />
        <button>Hoi Agent</button>
      </form>
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
    const { soTien, coGT } = hieuCauKhach(cau);
    if (soTien === 0) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<h1>Agent tra loi</h1><p>Em chua hieu so tien. Chi ghi lai giup em: "Gui 700 trieu co nguoi gioi thieu"</p><a href="/">Hoi lai</a>`);
      return;
    }
    const kq = tinhLai(soTien, coGT);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <h1>Agent tra loi</h1>
      <p><b>Khach hoi:</b> ${cau}</p>
      <p>Da, chi gui ${soTien.toLocaleString("vi-VN")}d, ${coGT ? "co coupon gioi thieu" : "khong co coupon"} thi lai suat la ${kq.laiSuat}%/nam.</p>
      <p><b>Tien lai 1 nam cua chi la: ${kq.tienLai.toLocaleString("vi-VN")}d a.</b></p>
      <a href="/">Hoi cau khac</a>
    `);
    return;
  }
});
if (process.env.VERCEL !== "1") {
  const PORT = Number(process.env.PORT || 3000);
  server.listen(PORT, () => {
    console.log(`Agent dang chay o port ${PORT}`);
  });
}

export default (req: any, res: any) => {
  server.emit("request", req, res);
};