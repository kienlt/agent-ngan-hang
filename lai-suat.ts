import { readFileSync } from "fs";

const laiSuatData = JSON.parse(readFileSync("./lai-suat.json", "utf-8"));

export function tinhLai(soTien: number, coNguoiGioiThieu: boolean) {
  const laiCongBo = laiSuatData.kyHan12Thang.congBo;
  const coupon = laiSuatData.kyHan12Thang.couponGioiThieu;

  let laiSuat = laiCongBo;
  if (coNguoiGioiThieu) {
    laiSuat = laiCongBo + coupon;
  }

  const tienLai = (soTien * laiSuat) / 100;
  const ghiChu = coNguoiGioiThieu ? "Co coupon gioi thieu" : "Khong co coupon";
  return { laiSuat, tienLai, ghiChu };
}