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
    // [임시 더미 데이터 - 키움 API 실제 연동 전]
    let currentPrice = 125000;
    
    const ma5 = Math.floor(currentPrice * 0.99);
    const ma20 = Math.floor(currentPrice * 0.97);
    const ma60 = Math.floor(currentPrice * 0.94);
    const ma120 = Math.floor(currentPrice * 0.88);
    const bollingerUpper = Math.floor(currentPrice * 1.05); 
    const bollingerLower = Math.floor(currentPrice * 0.89); 

    // 💡 서버가 제안하는 합리적 저항/지지선 세팅 (볼밴 상단과 20일선 기준)
    const autoResistance = bollingerUpper;
    const autoSupport = ma20;

    res.status(200).json({
      currentPrice: currentPrice,
      ma5: ma5, ma20: ma20, ma60: ma60, ma120: ma120,
      bollingerUpper: bollingerUpper,
      bollingerLower: bollingerLower,
      rsi: 65.93,
      trend: "주봉상 양운 (상승 추세)",
      autoResistance: autoResistance, // 자동 추천 저항선
      autoSupport: autoSupport        // 자동 추천 지지선
    });

  } catch (error) {
    res.status(500).json({ error: "API 에러" });
  }
}
