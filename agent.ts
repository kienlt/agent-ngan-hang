import {tinhLai} from './lai-suat';

function formatTien(n:number)
{
  return n.toLocaleString('vi-VN') + ' VND';

}
function agentTuVan(SoTien: number, CoNguoiGioiThieu: boolean)
{
  console.log(`\n-- Gói ${formatTien(SoTien)} Kỳ hạn 12 tháng --`);
  const kq = tinhLai(SoTien, CoNguoiGioiThieu);
  console.log(`Lãi suất: ${kq.laisuat}%/nam`);
  console.log(`Tiền lãi: ${formatTien(kq.tienlai)}`);
  console.log(`Ghi chú: ${kq.ghichu}`);
}
agentTuVan(500_000_000, false);
agentTuVan(500_000_000, true);
agentTuVan(200_000_000, true);
