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
    let cauChuan = cau.toLowerCase();
    cauChuan = cauChuan.replace(/tỏi|toi/g, "ty");
    cauChuan = cauChuan.replace(/\bcu\b|củ/g, "trieu");
    cauChuan = cauChuan.replace(/bốn|bon/g, "4");
    cauChuan = cauChuan.replace(/năm|nam/g, "5");

    const prompt = `Ban la nhan vien ngan hang. Hay doc cau hoi sau va tra ve JSON duy nhat.
Cau hoi goc: "${cau}"
Cau hoi da dich: "${cauChuan}"
QUAN TRONG NHAT: Neu cau co 2 so tien tro len, PHAI CONG HET TAT CA LAI. KHONG DUOC CHI LAY SO DAU TIEN.
Vi du:
- "400 trieu cong them 10 ty" = 400000000 + 10000000000 = 10400000000
- "400 trieu cong them 2 ty" = 400000000 + 2000000000 = 2400000000
- "500 trieu cong 2 ty" = 2500000000
- "1 ty 200 trieu" = 1200000000
Tra ve dung dang: {"soTien": 123, "coGT": true}
- soTien la TONG, so nguyen, bang VND.
- coGT = true neu co nguoi gioi thieu, co coupon. coGT = false neu khong co ai, tu den, mot minh.
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
  let chuan = cau.toLowerCase();
  for (const tu in TU_SO) chuan = chuan.replace(new RegExp("\\b" + tu + "\\b", "g"), String(TU_SO[tu]));
  const parts = chuan.match(/\d+(?:[.,]\d+)?|tram|muoi|nghin|trieu|ty|ti/g);
  if (!parts) return 0;
  let tong = 0;
  let phanTram = 0;
  let phanMuoi = 0;
  let soHienTai = 0;
  let coSo = false;
  let coDonVi = false;
  for (const p of parts) {
    if (/^\d/.test(p)) { soHienTai = Number(p.replace(",", ".")); coSo = true; }
    else if (p === "tram") { phanTram = (soHienTai || 1) * 100; soHienTai = 0; }
    else if (p === "muoi") { phanMuoi = (soHienTai || 1) * 10; soHienTai = 0; }
    else if (p === "trieu" || p === "ty" || p === "ti" || p === "nghin") {
      coDonVi = true;
      const donVi = p === "trieu" ? 1000000 : p === "nghin" ? 1000 : 1000000000;
      const nhom = phanTram + phanMuoi + (soHienTai || (phanTram === 0 && phanMuoi === 0 ? 1 : 0));
      tong += nhom * donVi;
      phanTram = 0; phanMuoi = 0; soHienTai = 0;
    }
  }
  if (!coDonVi && coSo) {
    if (soHienTai >= 1000 || phanTram >= 1000) tong = phanTram + phanMuoi + soHienTai;
    else tong = (phanTram + phanMuoi + soHienTai) * 1000000;
  }