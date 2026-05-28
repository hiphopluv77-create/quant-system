export default async function handler(req, res) {
  const tickerInput = req.query.ticker || "";

  // 💡 편의를 위해 한글 종목명을 6자리 코드로 변환하는 맵핑
  const stockMap = {
    "이수페타시스": "041510",
    "알테오젠": "196170",
    "엘앤씨바이오": "290650",
    "가온칩스": "393220",
    "삼성전자": "005930"
  };

  const stockCode = stockMap[tickerInput] || tickerInput.trim();

  try {
    // 🔐 1단계: Vercel 환경변수(금고)에서 키움증권 API 발급 키를 꺼내옵니다.
    // (보안을 위해 코드에 직접 적지 않고 process.env를 사용합니다)
    const APP_KEY = process.env.KIWOOM_APP_KEY;
    const APP_SECRET = process.env.KIWOOM_APP_SECRET;

    /*
      ===================================================================
      🔥 [키움 REST API 통신 핵심 로직]
      ===================================================================
      실제 운영 시에는 아래의 주석 처리된 부분처럼 키움증권으로부터 
      OAuth 2.0 접근 토큰(Access Token)을 발급받아 주가 데이터를 호출합니다.
    */

    /* // [토큰 발급 예시 구조]
    const tokenResponse = await fetch('키움증권_토큰발급_URL', {
        method: 'POST',
        body: JSON.stringify({ grant_type: 'client_credentials', appkey: APP_KEY, appsecret: APP_SECRET })
    });
    const tokenData = await tokenResponse.json();
    const ACCESS_TOKEN = tokenData.access_token;

    // [현재가 호출 예시 구조]
    const priceResponse = await fetch(`키움증권_주식현재가_URL?종목코드=${stockCode}`, {
        headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
    });
    const kiwoomData = await priceResponse.json();
    const currentPrice = kiwoomData.output.current_price; // 실제 응답 구조에 맞춰 파싱
    */

    // 💡 2단계: 현재는 API Key가 Vercel에 세팅되기 전이므로, 
    // 키움 API 통신이 성공했다는 가정 하에 종목별 실시간 변동 로직을 시뮬레이션합니다.
    // (API Key가 세팅되면 이 더미 데이터 대신 위 kiwoomData 결과값이 들어갑니다)

    let currentPrice;
    if (stockCode === "041510") currentPrice = 41500;      // 이수페타시스 예시
    else if (stockCode === "196170") currentPrice = 285000; // 알테오젠 예시
    else if (stockCode === "290650") currentPrice = 21000;  // 엘앤씨바이오 예시
    else currentPrice = 50000;

    // 💡 3단계: 차트 판독 저항/지지선 계산 (현재가 연동)
    const resistanceLine = Math.floor(currentPrice * 1.08 / 100) * 100; 
    const supportLine = Math.floor(currentPrice * 0.90 / 100) * 100;    
    const weeklyBastion = Math.floor(currentPrice * 0.80 / 100) * 100;  

    // 4. 분석 결과를 화면으로 전송
    res.status(200).json({
      ticker: tickerInput,
      currentPrice: currentPrice,
      resistanceLine: resistanceLine,
      supportLine: supportLine,
      disparity: 110,
      weeklyBastion: weeklyBastion,
      message: "키움 REST API 연동 준비 완료"
    });

  } catch (error) {
    res.status(500).json({ error: "키움 API 통신 중 에러가 발생했습니다." });
  }
}
