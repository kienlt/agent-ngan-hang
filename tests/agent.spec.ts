import { test, expect } from "@playwright/test";

const cases = [
  // [cau khach hoi, tien lai phai ra]
   ["Gui 700 trieu co nguoi gioi thieu thi duoc bao nhieu?", "67.200.000"],
  ["Gui 700 trieu khong co nguoi gioi thieu", "49.000.000"],
  ["Gui 500 trieu co nguoi gioi thieu", "48.000.000"],
  ["Gui 300 trieu khong nguoi gioi thieu", "21.000.000"],
  // Case số lẻ
  ["Gui 750 trieu co nguoi gioi thieu", "72.000.000"],
  ["Gui 123 trieu khong co nguoi gioi thieu", "8.610.000"],
  ["Gui 333 trieu co nguoi gioi thieu", "31.968.000"],
  // Case chữ
  ["Gui chin tram trieu co nguoi gioi thieu", "86.400.000"],
  ["Gui nam tram trieu khong co nguoi gioi thieu", "35.000.000"],
  ["Gui mot ty hai tram trieu co nguoi gioi thieu", "115.200.000"],
  ["Gui hai tram trieu khong nguoi gioi thieu", "14.000.000"],
  // Case trộn số + chữ
  ["Gui 9 tram 50 trieu co nguoi gioi thieu", "91.200.000"],
  ["Gui 1 ty 2 tram trieu khong co nguoi gioi thieu", "84.000.000"],
  ["Gui 2 ty 500 trieu co nguoi gioi thieu", "240.000.000"],
  // Case biên 999 triệu và 1 tỷ
  ["Gui 999 trieu co nguoi gioi thieu", "95.904.000"],
  ["Gui 999 trieu khong co nguoi gioi thieu", "69.930.000"],
  ["Gui 1 ty co nguoi gioi thieu", "96.000.000"],
  ["Gui 1 ty khong co nguoi gioi thieu", "70.000.000"],
  // Case khách gõ sai / viết tắt
  ["Gui 700tr co nguoi gioi thieu", "67.200.000"],
  ["Gui 700 trieu k co nguoi gioi thieu", "49.000.000"],
  //case vua co so vua co chu
  ["Gui 1 ty hai tram trieu co nguoi gioi thieu", "115.200.000"],
  ["Gui 1 ty hai tram trieu khong co nguoi gioi thieu", "84.000.000"],
    ["Gui mot ty 2 tram trieu co nguoi gioi thieu", "115.200.000"],
  ["Gui mot ty 2 tram trieu khong co nguoi gioi thieu", "84.000.000"],
];

for (const [cau, tienLai] of cases) {
  test(`Hoi: ${cau} -> phai ra ${tienLai}`, async ({ page }) => {
    await page.goto(`http://localhost:3000/hoi?cau=${encodeURIComponent(cau)}`);
    await expect(page.locator("body")).toContainText(tienLai);
  });
}