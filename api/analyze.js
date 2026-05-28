export default function handler(req, res) {
  res.status(200).json({ status: "Success", message: "키움증권 분석 서버 연결 완료!" });
}
