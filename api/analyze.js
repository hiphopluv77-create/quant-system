import axios from 'axios';

export default async function handler(req, res) {
  // 여기에 키움증권 REST API 통신 로직이 들어갑니다.
  res.status(200).json({ status: "Success", message: "키움증권 분석 서버 연결 준비 완료" });
}
