export default async function handler(req, res) {
  const tickerInput = req.query.ticker || "";

  const stockMap = {
    "이수페타시스": "041510",
    "알테오젠": "196170",
    "엘앤씨바이오": "290650",
    "가온칩스": "393220",
    "삼성전자": "005930"
  };
  const stockCode = stockMap[tickerInput] || tickerInput.trim();

  try {
    const APP_KEY = process.env.KIWOOM_APP_KEY;
    const APP_SECRET = process.env.KIWOOM_APP_SECRET;

    if (!APP_KEY || !APP_SECRET) {
        throw new Error("Vercel 환경 변수에 키움 API 키가 없습니다.");
    }

    // 1. 키움 토큰 발급 (키움 전용 도메인 적용)
    const tokenUrl = 'https://api.kiwoom.com/oauth2/token'; 
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=UTF-8' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        appkey: APP_KEY,
        appsecret: APP_SECRET
      })
    });
    
    // HTML 반환 등 404 에러 방어 로직
    const tokenText = await tokenResponse.text();
    let tokenData;
    try {
        tokenData = JSON.parse(tokenText);
    } catch (e) {
        throw new Error(`키움 서버 응답 에러: ${tokenText.substring(0, 50)}...`);
    }

    if(!tokenData.access_token) {
        throw new Error("토큰을 정상적으로 발급받지 못했습니다.");
    }

    // 🚨 2. 일봉 차트 (ka10081) 연동 대기 지점
    // 정확한 차트 URL을 넣기 전까지는 하단의 catch 문으로 넘겨 안전 모드를 가동합니다.
    throw new Error("NEED_KIWOOM_URL");

  } catch (error) {
    // 에러 발생 시 서버가 뻗지 않고 가상 데이터를 반환하여 UI가 작동하도록 방어
    let currentPrice = 125000;
    res.status(200).json({
      currentPrice: currentPrice,
      ma5: Math.floor(currentPrice * 0.99),
      ma20: Math.floor(currentPrice * 0.97),
      ma60: Math.floor(currentPrice * 0.94),
      ma120: Math.floor(currentPrice * 0.88),
      bollingerUpper: Math.floor(currentPrice * 1.05),
      bollingerLower: Math.floor(currentPrice * 0.89),
      rsi: 65, 
      trend: `⚠️ 안전 모드 가동 중 (실전 URL 연결 필요)`,
      autoResistance: Math.floor(currentPrice * 1.05),
      autoSupport: Math.floor(currentPrice * 0.97)
    });
  }
}
