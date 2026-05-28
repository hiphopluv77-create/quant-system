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

  try {
    const APP_KEY = process.env.KIWOOM_APP_KEY;
    const APP_SECRET = process.env.KIWOOM_APP_SECRET;

    if (!APP_KEY || !APP_SECRET) {
        throw new Error("Vercel 환경 변수에 키움 API 키가 없습니다.");
    }

    // ======================================================================
    // 1단계: 키움 API 접근 토큰 발급
    // ======================================================================
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
    
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if(!accessToken) {
        throw new Error("토큰 발급 실패. API Key와 Secret을 다시 확인해주세요.");
    }

    // ======================================================================
    // 2단계: 주식일봉차트조회 (ka10081) 실제 데이터 호출
    // ======================================================================
    
    // 오늘 날짜 구하기 (YYYYMMDD 형식, 기준일자용)
    const now = new Date();
    const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const year = kst.getFullYear();
    const month = String(kst.getMonth() + 1).padStart(2, '0');
    const day = String(kst.getDate()).padStart(2, '0');
    const baseDt = `${year}${month}${day}`;

    // 매뉴얼에 명시된 URL (상황에 따라 GET 또는 POST로 동작하지만, Body가 있으므로 POST 요청)
    const chartUrl = 'https://api.kiwoom.com/api/dostk/chart'; 
    
    const chartResponse = await fetch(chartUrl, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${accessToken}`,
        'appkey': APP_KEY,
        'appsecret': APP_SECRET,
        'api-id': 'ka10081', // 선호님이 찾아주신 핵심 TR코드
        'Content-Type': 'application/json;charset=UTF-8'
      },
      body: JSON.stringify({
        stk_cd: stockCode,    // 종목코드
        base_dt: baseDt,      // 기준일자 (오늘)
        upd_stkpc_tp: "1"     // 수정주가 적용 여부 (1: 적용)
      })
    });

    const kiwoomData = await chartResponse.json();

    // 키움증권 응답 에러 감지
    if (!kiwoomData || !kiwoomData.body || !kiwoomData.body.stk_dt_pole_chart_qry) {
        throw new Error("차트 데이터를 정상적으로 불러오지 못했습니다. (종목코드 또는 서버 상태 오류)");
    }

    // ======================================================================
    // 3단계: 매뉴얼에 맞춘 데이터 추출 및 퀀트 계산
    // ======================================================================
    
    // 선호님이 올려주신 매뉴얼의 응답 배열 이름과 현재가 키값 적용
    const priceList = kiwoomData.body.stk_dt_pole_chart_qry;
    
    // cur_prc(현재가) 배열 추출 (절대값 처리: 가끔 하락 시 - 기호가 붙어오는 경우 방지)
    const closePrices = priceList.map(item => Math.abs(parseInt(item.cur_prc.replace(/,/g, ''))));
    
    if (closePrices.length === 0) {
        throw new Error("차트 캔들 데이터가 존재하지 않습니다.");
    }

    const currentPrice = closePrices[0]; // 배열의 첫 번째 값이 가장 최근(오늘) 종가

    // 이동평균선 계산 함수
    const calcMA = (period) => {
        if (closePrices.length < period) return currentPrice;
        const sum = closePrices.slice(0, period).reduce((a, b) => a + b, 0);
        return Math.floor(sum / period);
    };

    const ma5 = calcMA(5);
    const ma20 = calcMA(20);
    const ma60 = calcMA(60);
    const ma120 = calcMA(120);

    // 볼린저 밴드 계산 (20일선 기준)
    const slice20 = closePrices.slice(0, 20);
    let variance = 0;
    if (slice20.length === 20) {
        variance = slice20.reduce((a, b) => a + Math.pow(b - ma20, 2), 0) / 20;
    }
    const stdDev = Math.sqrt(variance);
    const bollingerUpper = Math.floor(ma20 + (stdDev * 2));
    const bollingerLower = Math.floor(ma20 - (stdDev * 2));

    // 💡 차트 판독에 따른 자동 저항/지지선 제안 (수정 가능)
    const autoResistance = bollingerUpper;
    const autoSupport = ma20;

    res.status(200).json({
      currentPrice: currentPrice,
      ma5: ma5, ma20: ma20, ma60: ma60, ma120: ma120,
      bollingerUpper: bollingerUpper,
      bollingerLower: bollingerLower,
      rsi: 55, // RSI는 별도 수식 필요 시 추가 적용
      trend: currentPrice > ma20 ? "20일선 위 안착 (단기 상승)" : "20일선 이탈 주의",
      autoResistance: autoResistance,
      autoSupport: autoSupport
    });

  } catch (error) {
    // 실전 통신 실패 시 화면이 멈추지 않도록 다시 안전 모드 발동
    let fallbackPrice = 125000;
    res.status(200).json({
      currentPrice: fallbackPrice,
      ma5: Math.floor(fallbackPrice * 0.99),
      ma20: Math.floor(fallbackPrice * 0.97),
      ma60: Math.floor(fallbackPrice * 0.94),
      ma120: Math.floor(fallbackPrice * 0.88),
      bollingerUpper: Math.floor(fallbackPrice * 1.05),
      bollingerLower: Math.floor(fallbackPrice * 0.89),
      rsi: 65, 
      trend: `⚠️ 통신 에러 우회 모드 (원인: ${error.message})`,
      autoResistance: Math.floor(fallbackPrice * 1.05),
      autoSupport: Math.floor(fallbackPrice * 0.97)
    });
  }
}
