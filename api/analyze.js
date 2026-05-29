import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

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
    
    // Vercel 금고에서 프록시(우회) 정보 꺼내기
    const P_IP = process.env.PROXY_IP;
    const P_PORT = process.env.PROXY_PORT;
    const P_USER = process.env.PROXY_USER;
    const P_PASS = process.env.PROXY_PASS;

    if (!APP_KEY || !P_IP) {
        throw new Error("Vercel 환경 변수(API 키 또는 프록시 정보)가 누락되었습니다.");
    }

    // 🚀 고정 IP 프록시 우회 엔진 장착
    const proxyUrl = `http://${P_USER}:${P_PASS}@${P_IP}:${P_PORT}`;
    const proxyAgent = new HttpsProxyAgent(proxyUrl);

    // ======================================================================
    // 1단계: 키움 API 접근 토큰 발급 (프록시 경유)
    // ======================================================================
    const tokenUrl = 'https://api.kiwoom.com/oauth2/token'; 
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      agent: proxyAgent, // 💡 키움 서버에 Webshare의 고정 IP로 보이게끔 요청
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
        throw new Error("토큰 발급 실패. 프록시 IP 차단 또는 키움증권 HTS/MTS에서 '해외 IP 차단'이 설정되어 있는지 확인하세요.");
    }

    // ======================================================================
    // 2단계: 주식일봉차트조회 (ka10081) 실제 데이터 호출 (프록시 경유)
    // ======================================================================
    const now = new Date();
    const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const year = kst.getFullYear();
    const month = String(kst.getMonth() + 1).padStart(2, '0');
    const day = String(kst.getDate()).padStart(2, '0');
    const baseDt = `${year}${month}${day}`;

    const chartUrl = 'https://api.kiwoom.com/api/dostk/chart'; 
    
    const chartResponse = await fetch(chartUrl, {
      method: 'POST',
      agent: proxyAgent, // 💡 동일하게 고정 IP 유지
      headers: {
        'authorization': `Bearer ${accessToken}`,
        'appkey': APP_KEY,
        'appsecret': APP_SECRET,
        'api-id': 'ka10081',
        'Content-Type': 'application/json;charset=UTF-8'
      },
      body: JSON.stringify({
        stk_cd: stockCode,
        base_dt: baseDt,
        upd_stkpc_tp: "1" 
      })
    });

    const kiwoomData = await chartResponse.json();

    if (!kiwoomData || !kiwoomData.body || !kiwoomData.body.stk_dt_pole_chart_qry) {
        throw new Error("차트 데이터를 정상적으로 불러오지 못했습니다.");
    }

    // ======================================================================
    // 3단계: 매뉴얼에 맞춘 데이터 추출 및 퀀트 계산
    // ======================================================================
    const priceList = kiwoomData.body.stk_dt_pole_chart_qry;
    const closePrices = priceList.map(item => Math.abs(parseInt(item.cur_prc.replace(/,/g, ''))));
    
    if (closePrices.length === 0) throw new Error("차트 캔들 데이터가 존재하지 않습니다.");

    const currentPrice = closePrices[0]; 

    const calcMA = (period) => {
        if (closePrices.length < period) return currentPrice;
        const sum = closePrices.slice(0, period).reduce((a, b) => a + b, 0);
        return Math.floor(sum / period);
    };

    const ma5 = calcMA(5);
    const ma20 = calcMA(20);
    const ma60 = calcMA(60);
    const ma120 = calcMA(120);

    const slice20 = closePrices.slice(0, 20);
    let variance = 0;
    if (slice20.length === 20) {
        variance = slice20.reduce((a, b) => a + Math.pow(b - ma20, 2), 0) / 20;
    }
    const stdDev = Math.sqrt(variance);
    const bollingerUpper = Math.floor(ma20 + (stdDev * 2));
    const bollingerLower = Math.floor(ma20 - (stdDev * 2));

    const autoResistance = bollingerUpper;
    const autoSupport = ma20;

    res.status(200).json({
      currentPrice: currentPrice,
      ma5: ma5, ma20: ma20, ma60: ma60, ma120: ma120,
      bollingerUpper: bollingerUpper,
      bollingerLower: bollingerLower,
      rsi: 55, 
      trend: currentPrice > ma20 ? "20일선 위 안착 (단기 상승)" : "20일선 이탈 주의",
      autoResistance: autoResistance,
      autoSupport: autoSupport
    });

  } catch (error) {
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
      trend: `⚠️ 우회 모드 (원인: ${error.message})`,
      autoResistance: Math.floor(fallbackPrice * 1.05),
      autoSupport: Math.floor(fallbackPrice * 0.97)
    });
  }
}
