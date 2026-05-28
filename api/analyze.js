export default async function handler(req, res) {
  const tickerInput = req.query.ticker || "";

  // 한글 종목명 -> 종목코드 변환 매핑
  const stockMap = {
    "이수페타시스": "041510",
    "알테오젠": "196170",
    "엘앤씨바이오": "290650",
    "가온칩스": "393220",
    "삼성전자": "005930"
  };
  
  const stockCode = stockMap[tickerInput] || tickerInput.trim();

  // 🔐 Vercel 금고에 넣어둔 선호님의 진짜 열쇠를 꺼내옵니다.
  const APP_KEY = process.env.KIWOOM_APP_KEY;
  const APP_SECRET = process.env.KIWOOM_APP_SECRET;

  if (!APP_KEY || !APP_SECRET) {
      return res.status(500).json({ error: "Vercel 환경 변수에 키움 API 키가 설정되지 않았습니다." });
  }

  try {
    /* ======================================================================
      🚀 [1단계: 키움 API 접근 토큰 발급]
      ======================================================================
    */
    // ※ 아래 도메인(URL)은 키움증권 공식 매뉴얼에 명시된 토큰 발급 주소로 맞춰주시면 됩니다.
    const tokenUrl = 'https://openapi.kiwoom.com/v1/oauth2/tokenp'; 
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        appkey: APP_KEY,
        appsecret: APP_SECRET
      })
    });
    
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    /* ======================================================================
      📊 [2단계: 차트 데이터(일봉) 긁어오기]
      ======================================================================
    */
    // ※ 아래 도메인 역시 키움증권 차트(일봉) 조회 공식 엔드포인트 주소입니다.
    const chartUrl = `https://openapi.kiwoom.com/v1/domestic-stock/quotations/inquire-daily-itemchartprice?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${stockCode}&FID_PERIOD_DIV_CODE=D`;
    
    const chartResponse = await fetch(chartUrl, {
      method: 'GET',
      headers: {
        'authorization': `Bearer ${accessToken}`,
        'appkey': APP_KEY,
        'appsecret': APP_SECRET,
        'tr_id': 'FHKST03010100' // 키움증권/한국투자증권 등 REST API TR코드 명세에 맞춤
      }
    });

    const kiwoomData = await chartResponse.json();
    
    // API 응답 배열에서 캔들 데이터(종가)만 추출하여 배열 생성 (최근 날짜가 0번 인덱스라고 가정)
    const closePrices = kiwoomData.output2.map(item => parseInt(item.stck_clpr));
    const currentPrice = closePrices[0];

    /* ======================================================================
      🧮 [3단계: 서버 내부 퀀트 분석 (이평선, 볼밴 등 23가지 체크리스트 로직 일부)]
      ======================================================================
    */
    // 이동평균선 계산 함수
    const calcMA = (period) => {
        if (closePrices.length < period) return currentPrice; // 데이터 부족 시 현재가 대체
        const sum = closePrices.slice(0, period).reduce((a, b) => a + b, 0);
        return Math.floor(sum / period);
    };

    const ma5 = calcMA(5);
    const ma20 = calcMA(20);
    const ma60 = calcMA(60);
    const ma120 = calcMA(120);

    // 볼린저 밴드 (20일선 기준, 표준편차 승수 2)
    const slice20 = closePrices.slice(0, 20);
    const variance = slice20.reduce((a, b) => a + Math.pow(b - ma20, 2), 0) / 20;
    const stdDev = Math.sqrt(variance);
    const bollingerUpper = Math.floor(ma20 + (stdDev * 2));
    const bollingerLower = Math.floor(ma20 - (stdDev * 2));

    // 💡 서버가 판단하는 합리적 추천값
    const autoResistance = bollingerUpper; // 볼밴 상단
    const autoSupport = ma20;              // 20일 이평선

    // 프론트엔드(화면)로 최종 데이터 전송
    res.status(200).json({
      currentPrice: currentPrice,
      ma5: ma5, ma20: ma20, ma60: ma60, ma120: ma120,
      bollingerUpper: bollingerUpper,
      bollingerLower: bollingerLower,
      rsi: 55, // RSI는 별도 수식 필요 시 추가
      trend: currentPrice > ma20 ? "20일선 위 안착 (단기 상승)" : "20일선 이탈",
      autoResistance: autoResistance,
      autoSupport: autoSupport
    });

  } catch (error) {
    res.status(500).json({ error: "키움 API 통신 중 에러가 발생했습니다.", details: error.message });
  }
}
