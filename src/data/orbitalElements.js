// J2000 平轨道根数：角度单位为度，周期单位为地球日。
// 数据参考 NASA / JPL 的 J2000 近似星历；渲染距离为科普可视化压缩比例。
export const ORBITAL_ELEMENTS = {
  '水星': { a: 0.38709893, e: 0.20563069, i: 7.00487, node: 48.33167, perihelion: 77.45645, longitude: 252.25084, period: 87.969, rotationHours: 1407.6, renderDistance: 620 },
  '金星': { a: 0.72333199, e: 0.00677323, i: 3.39471, node: 76.68069, perihelion: 131.53298, longitude: 181.97973, period: 224.701, rotationHours: -5832.5, renderDistance: 850 },
  '地球': { a: 1.00000011, e: 0.01671022, i: 0.00005, node: -11.26064, perihelion: 102.94719, longitude: 100.46435, period: 365.256, rotationHours: 23.9345, renderDistance: 1100 },
  '火星': { a: 1.52366231, e: 0.09341233, i: 1.85061, node: 49.57854, perihelion: 336.04084, longitude: 355.45332, period: 686.98, rotationHours: 24.6229, renderDistance: 1400 },
  '木星': { a: 5.20336301, e: 0.04839266, i: 1.3053, node: 100.55615, perihelion: 14.75385, longitude: 34.40438, period: 4332.589, rotationHours: 9.925, renderDistance: 2100 },
  '土星': { a: 9.53707032, e: 0.0541506, i: 2.48446, node: 113.71504, perihelion: 92.43194, longitude: 49.94432, period: 10759.22, rotationHours: 10.656, renderDistance: 2850 },
  '天王星': { a: 19.19126393, e: 0.04716771, i: 0.76986, node: 74.22988, perihelion: 170.96424, longitude: 313.23218, period: 30685.4, rotationHours: -17.24, renderDistance: 3800 },
  '海王星': { a: 30.06896348, e: 0.00858587, i: 1.76917, node: 131.72169, perihelion: 44.97135, longitude: 304.88003, period: 60189, rotationHours: 16.11, renderDistance: 4800 },
  '冥王星': { a: 39.48168677, e: 0.24880766, i: 17.14175, node: 110.30347, perihelion: 224.06676, longitude: 238.92881, period: 90560, rotationHours: -153.2928, renderDistance: 6000 }
};
