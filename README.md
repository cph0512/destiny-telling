# destiny-telling

給 AI agent 與本機程式使用的北派紫微、八字、疊宮及雙向交叉計算。只提供數值與結構資料，以及本機 stdio MCP；不提供模型 API 呼叫、HTTP 服務、外部 KB 存取、預測解讀文章或資料持久化。計算期間不需 API key，也不會把輸入送往遠端。

結果為傾向非定論、不構成醫療法律投資建議

解讀知識庫是另一個私有服務（destinytelling.life），不在本 repo

上面兩句是範圍與免責聲明，不是解讀知識庫。本專案不產生吉凶評分、投資指令或醫療法律判斷。

## 安裝與執行範圍

預定 GitHub 來源是 `cph0512/destiny-telling`。以下安裝指令適用於該 repository 已建立、且呼叫者有讀取權限時；本文件不宣稱遠端已建立、已公開或已發布至 npm。

```sh
git clone https://github.com/cph0512/destiny-telling.git
cd destiny-telling
npm ci --ignore-scripts
```

- `package.json` 要求 Node `>=25.9.0`；目前實測的 runtime 是 Node `v25.9.0`，沒有第二個 Node 版本或其他作業系統的相容性測試結論。
- 專案是 ESM，root entry 為 `index.js`；不需 build。
- `private: true` 刻意防止 `npm publish`，與 GitHub repository 的 PRIVATE/PUBLIC 可見性無關。不要把套件名稱當作 npm 已發布的證據。
- MCP 已實測直接執行 `node /absolute/path/destiny-telling/mcp/server.js`，以及測試擁有的 `destiny-telling-mcp` symlink（透過 Node 與可執行 shebang 兩種啟動）。這是入口回歸測試，尚未驗證真正 npm 安裝後的 bin。
- stdio server 由 client 啟動為子程序；stdout 保留給 JSON-RPC，不能在該程序插入一般 log。它不是 HTTP endpoint，不監聽網路 port。

## Claude / Cursor 的本機 stdio 設定

下列各是一份 `mcpServers` JSON 設定片段，不是已替你安裝到 client 的設定，也不宣稱任何特定 client 版本已實測。將 `/absolute/path/destiny-telling` 換成自己的 checkout 絕對路徑；若 client 的 PATH 找不到 `node`，將 `command` 換成自己的 Node 執行檔絕對路徑。不要把兩者當成同一個路徑。

Claude：

```json
{
  "mcpServers": {
    "destiny-telling": {
      "command": "node",
      "args": ["/absolute/path/destiny-telling/mcp/server.js"]
    }
  }
}
```

Cursor：

```json
{
  "mcpServers": {
    "destiny-telling": {
      "command": "node",
      "args": ["/absolute/path/destiny-telling/mcp/server.js"]
    }
  }
}
```

將片段合併進自己 client 的 MCP 設定後，由該 client 啟動。server 不需要登入、金鑰或環境變數。MCP 只有下面五個工具，沒有 KB、儲存或模型工具。

## 輸入共通規則

所有 MCP 工具都接受一個 JSON object。root object 與 `cross_sihua.a/b` 均拒絕未知欄位（`additionalProperties: false`）。不要傳 `id`、姓名、時區或其他未列欄位。字串不會被轉成數字；不自動修正日期、取整數或轉換性別。省略與 `null` 不同；下表的 optional 欄位不能以 `null` 代替。

`scope` 與 `levels` 的跨欄位依存由 server refinement 執行，並寫在 descriptions 與下列表格；不要假設 `tools/list` 的 JSON Schema 已把所有條件編碼為 `if/then`。欄位出現在 properties 中不表示任何 scope 都能傳。

共用 `Birth`：

| 欄位 | 型別 / 驗證範圍 | 必填 | 省略時 |
| --- | --- | --- | --- |
| `birthDate` | string，補零 `YYYY-MM-DD`，真實公曆日期 | 是 | 無預設 |
| `hour` | integer，0..23，出生當地民用小時 | 是 | 無預設 |
| `minute` | integer，0..59，出生分鐘 | 否 | 0 |
| `gender` | string，只接受 `男` 或 `女` | 是 | 無預設 |

所有日期欄位均使用同一驗證：四位年份 0001..9999、月份 01..12、日數符合公曆閏年與該月天數，不接受時間尾碼或未補零日期。這是輸入驗證範圍，不是上游曆法在所有年份皆可計算的保證；上游不支援的計算可能被拒絕，或在原先允許的分支以 `null` 標明時間層缺失，不補造結果。實測覆蓋以後面的測試段落為準。

日期與小時不做時區、夏令時間或真太陽時校正。呼叫者須先決定要送入的民用日期與時間。`hour/minute` 是出生時分；`targetHour/targetMinute` 才是目標流時，不可互換。

出生分鐘會保留在正規化的 `input`，但上游紫微（含 overlay/cross）與 finance 不套用分鐘；八字將出生分鐘傳給 `lunar-javascript`。`targetMinute` 保留但上游流時不套用，不代表分鐘級精度。root daily 計算使用出生分鐘 0，並明列限制。

## 共通輸出 envelope

以下所有型別區塊都是 schema/shape 說明，不是執行結果，也不是可直接解析的 JSON。未提供任何臆造的數值輸出；後面的 JSON 範例均為合成輸入。

成功的 MCP `tools/call` result：

```text
{
  structuredContent: Envelope,
  content: [{ type: "text", text: JSON.stringify(Envelope) }]
}
```

`structuredContent` 與唯一 text 解碼後的 object 完全相等。成功不另加 `isError: false`。所有計算的 JSON companion 都回傳 envelope object，不是已序列化的字串。

```text
Envelope = {
  schema: "destiny-telling.calc/v1",
  kind: string,                      // 見各工具 / root API 對照
  input: object,                     // 正規化輸入，見各工具
  referenceDate: DateString | null,  // 不放在 input 裡冒充出生欄位
  config: {
    school: "north",
    gengMutagens: ["太陽", "武曲", "天同", "天相"]
  },
  data: object,                      // 各工具專屬 schema
  omitted: string[],                 // 明列未輸出的欄位路徑
  limitations: string[]              // 機器可讀限制碼
}
```

`DateString` 是上述日期字串，`S` 是 string，`N` 是有限 number，`I` 是有限 integer；`T[]` 為陣列、`Record<S,T>` 為以字串作 key 的 object、`?` 表示該欄位可能不存在。這些符號只是文件型別記法，沒有隱藏欄位。

無效輸入回 `isError: true` 與 text content，不回 `structuredContent`。handler 計算例外的固定訊息是 `Calculation rejected: invalid or unsupported input.`；SDK 前置 schema 驗證的文字可能不同。不要依賴錯誤文字作 schema，亦不要把錯誤當作空盤。測試檢查錯誤不回顯整份輸入或合成出生日期，不代表已窮盡任意惡意字串。

### 共用資料型別（shape，非結果）

```text
LocatedHua = { star: S, hua: S, zhi: S | null, gongName: S }
Effect = { star: S, hua: S, source: S }
ChartPeriod = {
  ganZhi: S, sihua: S[], mingGongZhi: S,
  dieBenGong: S, palaceNames: S[]
}
FinancePalace = { gan: S, zhi: S, stars: S[], minor: S[] }
FinanceTemporalPalace = FinancePalace & { dieBen: S }
```

星名、宮名、干支、四化名稱及 `detail/sourceLabel` 等字串是計算標籤或事實列舉，不是解讀文章。原本本命四化的短標籤與各層標籤保留原行為，agent 不應自行把它們正規化後宣稱與原演算法相同。

## 五個 MCP 工具

### 1. `ziwei_chart`

輸入：`Birth` 全部欄位，加上：

| 欄位 | 型別 | 必填 | 省略時 |
| --- | --- | --- | --- |
| `referenceDate` | DateString | 否 | 執行時程序的實際本地日期 |

以該日期建立時間層；明確給定日期才能避免「今天」造成結果隨執行日變動。不是只替輸出加日期標籤。

合成輸入（fixture S1；fixture 的 `id` 不送入工具）：

```json
{"birthDate":"2001-03-07","hour":6,"minute":10,"gender":"女","referenceDate":"2026-10-24"}
```

輸出：`kind = "ziwei.chart"`，`input = Birth`（含補上的 `minute`），`referenceDate` 是實際使用日期，`data = ZiweiChart`：

```text
ZiweiChart = {
  basic: {
    solarDate: S, lunarDate: S, yearGanZhi: S, shiChen: S,
    gender: "男" | "女", yinYang: S, mingGong: S, mingGongZhi: S,
    shenGong: S, commandStar: S, bodyStar: S, wuXingJu: S,
    lunarMonth: I, shiChenIdx: I
  },
  gongs: Record<S, {
    name: S, stars: S[], minor: S[], sihua: S[], changSheng: S
  }>,
  gongGan: Record<S,S>,
  daXian: { zhi: S, startAge: N, endAge: N }[],
  siHua: Record<S,S>,
  feiHua: Record<S, { gan: S, sihua: S[] }>,
  horoscope: null | {
    decadal: ChartPeriod,
    yearly: ChartPeriod,
    age: { nominalAge: N, ganZhi: S, sihua: S[], dieBenGong: S }
  }
}
```

宮位 maps 以地支作 key，`siHua` 以星名作 key。上游無法取得時間層時 `horoscope` 為 `null`，不代表有可用流年資料。`omitted = []`；`limitations = ["UPSTREAM_ZIWEI_BIRTH_MINUTE_NOT_APPLIED"]`。

### 2. `ziwei_overlay`

輸入：`Birth` 全部欄位，加上：

| 欄位 | 型別 / 範圍 | 必填 / 可用條件 | 省略時 |
| --- | --- | --- | --- |
| `scope` | `year` / `month` / `day` | 是 | 無預設 |
| `targetDate` | DateString | 是，所有 scope 都需要 | 無預設 |
| `month` | integer，1..12，明確斗君月序 | 僅 `month` scope，且此時必填 | 其他 scope 不得傳 |
| `targetHour` | integer，0..23 | 僅 `day` scope | 不計算流時，`hourly: null` |
| `targetMinute` | integer，0..59 | 僅 `day`，且必須同時有 `targetHour` | 不送入目標分鐘；不影響上游結果 |

`targetDate` 會用來重建盤及決定參考年。`year` 算全部 1..12 斗君月；`month` 只選明確指定的斗君月。這個 `month` 不是 `targetDate` 的公曆月，也不會自動從公曆或農曆日期換算。`year/month` 不接受目標時分；`day` 不接受 `month`；此工具不接受額外 `referenceDate`。

三個 scope 的合成輸入（S2）：

```json
{"birthDate":"1990-11-02","hour":21,"minute":40,"gender":"男","scope":"year","targetDate":"2026-10-24"}
```

```json
{"birthDate":"1990-11-02","hour":21,"minute":40,"gender":"男","scope":"month","targetDate":"2026-10-24","month":6}
```

```json
{"birthDate":"1990-11-02","hour":21,"minute":40,"gender":"男","scope":"day","targetDate":"2026-10-24","targetHour":23,"targetMinute":59}
```

`year/month` 輸出：`kind = "ziwei.transit"`，`input = {...Birth, months: I[]}`，分別是全部斗君序或單一選定序；envelope 不保留 `scope`，`referenceDate = targetDate`。

```text
TransitData = {
  decadal: OverlayPeriod,
  yearly: OverlayPeriod,
  monthly: Record<S, {
    mingGongZhi: S, dieBenGong: S, gan: S | null,
    effects: (Effect & { zhi: S, gongName: S })[]
  }>,
  palaceEffects: Record<S, {
    gongName: S, stars: S[], natal: Effect[], decadal: Effect[],
    yearly: Effect[], monthly: Record<S,Effect[]>
  }>,
  highlights: TransitHighlight[]
} | { result: null }
OverlayPeriod = {
  ganZhi: S, mingGongZhi: S, dieBenGong: S, sihua: LocatedHua[]
}
TransitHighlight =
  { type: "雙祿" | "雙忌" | "祿忌同宮", zhi: S, gongName: S, detail: S }
  | { type: "雙權", zhi: S, gongName: S }
  | { type: "化忌沖", zhi: S, gongName: S, targetGong: S, detail: S }
  | { type: "三祿疊" | "三忌疊", zhi: S, gongName: S, month: I, detail: S }
```

`monthly` 的 keys 是所選斗君序的十進位字串，不是日期；`palaceEffects` 以地支作 key。`{result:null}` 表示原 overlay 無資料，不是已算出空白的全年。

`highlights` 是原條件的命中紀錄，不是新評分：雙類各為同類至少 2 筆、祿忌同宮各至少 1 筆；三類包含該斗君月後同類至少 3 筆；沖的對宮結構亦保留。原本本命短標籤的判斷行為未改，不能把紀錄數當作另外定義的機率或風險分數。

- `omitted = ["summary", "_lookup", "highlights[].impact", "highlights[type=雙權].detail"]`
- `limitations = ["UPSTREAM_ZIWEI_BIRTH_MINUTE_NOT_APPLIED", "MONTHS_ARE_DOUJUN_ORDER_NOT_CALENDAR_CONVERSION", "RAW_TARGET_YEAR_IS_LABEL_ONLY"]`

`day` 輸出：`kind = "ziwei.dayhour"`，`input = {...Birth, targetDate, targetHour?, targetMinute?}`，只保留實際提供的目標時分，`referenceDate = targetDate`。

```text
DayHourData = {
  daily: { gan: S, zhi: S, ganZhi: S, sihua: LocatedHua[] },
  hourly: null | {
    gan: S | null, zhi: S, shichenIdx: I,
    ganZhi: S | null, sihua: LocatedHua[]
  },
  highlights: {
    type: "多祿疊" | "多忌疊" | "祿忌同宮", gongName: S, detail: S
  }[]
} | { result: null }
```

找不到星時保留 `zhi: null` 與事實標記 `gongName: "（本命無此星）"`，不補造宮位。`shichenIdx` 為時辰索引，不是分鐘。

- `omitted = ["summary", "highlights[].impact"]`
- `limitations = ["UPSTREAM_ZIWEI_BIRTH_MINUTE_NOT_APPLIED", "UPSTREAM_TARGET_MINUTE_NOT_APPLIED"]`

### 3. `bazi_chart`

輸入恰為 `Birth`：必填 `birthDate/hour/gender`，`minute` 可省略而為 0；不接受 `referenceDate` 或目標日期。

合成輸入（S1）：

```json
{"birthDate":"2001-03-07","hour":6,"minute":10,"gender":"女"}
```

輸出：`kind = "bazi.chart"`，`input = Birth`，`referenceDate = null`，`omitted = []`，`limitations = []`。

```text
BaziData = {
  solarDate: S, lunarDate: S, gender: "男" | "女", shiChen: S,
  pillars: { year: Pillar, month: Pillar, day: Pillar, time: Pillar },
  dayMaster: S, dayWuXing: S,
  wuXing: { 金: I, 木: I, 水: I, 火: I, 土: I },
  daYun: { ganZhi: S, startAge: N, startYear: N }[],
  startAge: N, shengXiao: S
}
Pillar = {
  ganZhi: S, naYin: S, shiShenGan: S, shiShenZhi: S[], hideGan: S[]
}
```

空的 `limitations` 不是對曆法或命理有效性的全面保證，只表示這個 wrapper 沒有附加限制碼。

### 4. `cross_sihua`

| 欄位 | 型別 / 範圍 | 必填 / 可用條件 | 省略時 |
| --- | --- | --- | --- |
| `a` | strict `Birth` object | 是 | 無預設；內層 minute 仍預設 0 |
| `b` | strict `Birth` object | 是 | 無預設；內層 minute 仍預設 0 |
| `referenceDate` | DateString | 是 | 無預設；用同一天建立雙盤 |
| `levels` | 下列 enum 的非空、無重複陣列，1..8 個 | 否 | `["natal","palace","decadal","yearly"]` |
| `month` | integer，1..12，明確斗君月序 | 選 `monthly` 時必填，未選不得傳 | 無自動換算 |
| `targetDate` | DateString | 選 `daily` 時必填，未選不得傳 | 無預設 |

`levels` 的合法值及輸出 layer：`natal → L1`、`palace → L2`、`decadal → L3`、`yearly → L4`、`pastDecadal → L3b`、`pastDecadal2 → L3c`、`monthly → L5`、`daily → L6`。

`referenceDate` 選雙盤時間層及相對歷史大限；`targetDate` 只供選中的流日計算，不把雙盤參考日偷偷換成該日。`month` 同樣是斗君序，與 `targetDate` 月份無自動對應。`pastDecadal/pastDecadal2` 依原 `daXian` 陣列索引取得前一與前兩個位置，不重新排序；不存在的歷史大限不產生該層 flights，不報成計算錯誤，也不補造星曜。

合成輸入（S3/S4，八層包含 monthly/daily/前兩大限）：

```json
{
  "a":{"birthDate":"1975-07-19","hour":0,"minute":20,"gender":"女"},
  "b":{"birthDate":"1963-12-30","hour":23,"minute":30,"gender":"男"},
  "referenceDate":"2026-10-24",
  "levels":["natal","palace","decadal","yearly","pastDecadal","pastDecadal2","monthly","daily"],
  "month":6,
  "targetDate":"2026-10-25"
}
```

輸出：`kind = "cross.sihua"`，`input = {a: Birth, b: Birth, levels: S[], month?, targetDate?}`，條件欄位只在所選層存在。`referenceDate` 為雙盤參考日。

```text
CrossData = {
  flights: { aToB: Flight[], bToA: Flight[] },
  meta: { levels: S[], nameA: "甲方", nameB: "乙方" }
}
Flight = {
  layer: "L1" | "L2" | "L3" | "L4" | "L3b" | "L3c" | "L5" | "L6",
  layerLabel: S, sourceLabel: S,
  fromPalace: S | null,
  fromPalaceZhi?: S, fromGan?: S,
  star: S, hua: S, toPalace: S, toPalaceZhi: S,
  starKind: "major" | "minor"
}
```

`fromPalaceZhi/fromGan` 只在 L2，且 L2 的 `fromPalace` 為字串；其他層 `fromPalace` 為 `null`。同一方向的執行順序固定為 L1、L2、L3、L4、L3b、L3c、L5、L6，與呼叫者排列 `levels` 的次序不同；`meta.levels` 保留選擇次序。JSON/MCP 不接受 `nameA/nameB` 或人物身分，固定使用甲方/乙方。

- `omitted = ["summary"]`
- `limitations = ["UPSTREAM_ZIWEI_BIRTH_MINUTE_NOT_APPLIED", "MONTHS_ARE_DOUJUN_ORDER_NOT_CALENDAR_CONVERSION", "MISSING_HISTORICAL_DECADES_PRODUCE_NO_FLIGHTS"]`

### 5. `finance_chart`

輸入：`Birth` 全部欄位，加上 optional `referenceDate: DateString`；省略時取程序實際本地日期。沒有其他欄位或預設。出生分鐘只保留，不參與上游計算。

合成輸入（S2）：

```json
{"birthDate":"1990-11-02","hour":21,"minute":40,"gender":"男","referenceDate":"2026-10-24"}
```

輸出：`kind = "finance.chart"`，`input = Birth`，`referenceDate` 為實際使用日期：

```text
FinanceData = {
  basic: {
    solarDate: S, lunarDate: S, chineseDate: S, gender: "男" | "女",
    mingGong: S, shenGong: S, juName: S, yearSihua: Record<S,S>
  },
  benMing: Record<S,FinancePalace | null>,
  keyFeiHua: Record<S,{ gan: S, sihua: S[] }>,
  decadal: FinancePeriod,
  yearly: FinancePeriod,
  months: { month: I, ganZhi: S, sihua: S[], caiBo?: FinanceTemporalPalace }[],
  age: { nominalAge: N, ganZhi: S, sihua: S[] }
}
FinancePeriod = {
  ganZhi: S, sihua: S[], palaces: Record<S,FinanceTemporalPalace>
}
```

本命/時間宮位 maps 以宮名作 key；`yearSihua` 以星名作 key。`benMing` 選取命宮、財帛、官祿、遷移、福德、田宅、子女、交友等原始宮位資料，不輸出投資建議。

注意：`finance.data.months[].month` 是原實作在參考年每個公曆月 15 日取樣的 1..12 索引，與 `ziwei_overlay/cross_sihua` 的輸入斗君序不是同一個介面。此工具沒有供呼叫者指定的 `month` 欄位；不要把取樣結果誤當全年每一天或自動換算後的斗君月。

`omitted = []`；`limitations = ["UPSTREAM_FINANCE_HOUR_PRECISION_MINUTE_NOT_APPLIED"]`。

## Root ESM API

在 checkout 根目錄旁的 ESM 程式使用相對 import，或自行換成實際 module URL：

```js
import {
  calculateChartJson, calculateCrossSihuaJson,
  calculateBaziJson, calculateFinanceJson, calculateDailyJson,
  getMonthlySihuaStarsJson
} from './index.js';

const birth = { birthDate: '2001-03-07', hour: 6, minute: 10, gender: '女' };
const chart = calculateChartJson({ ...birth, referenceDate: '2026-10-24' });
const monthly = getMonthlySihuaStarsJson(chart.data, 6);
// chart 與 monthly 都是 envelope object；此範例沒有宣稱任何計算數值。
```

以下列全計算函式與 JSON companions。`y/m/d` 是整數公曆日期組件；`birth` 指上述 strict Birth。建議跨程序傳輸都用 `Json` 版本；原 raw 簽章彼此時分/性別的參數次序不同，不能任意交換。

| Raw / helper 簽章 | JSON companion 與輸入 | kind / data |
| --- | --- | --- |
| `calculateChart(y,m,d,hour,minute,gender,options={})` | `calculateChartJson({...birth,referenceDate?})` | `ziwei.chart` / 上述 ZiweiChart |
| `calculateTransitOverlay(chart,targetYear=null,targetMonths=null)` | `calculateTransitOverlayJson({...birth,referenceDate,months?})` | `ziwei.transit` / 上述 TransitData |
| `calculateDayHourOverlay(chart,y,m,d,hour=null,minute=null)` | `calculateDayHourOverlayJson({...birth,targetDate,targetHour?,targetMinute?})` | `ziwei.dayhour` / 上述 DayHourData |
| `formatChartByTianGan(y,m,d,gender)`（事實字串） | `calculateChartByTianGanJson({birthDate,gender})` | `ziwei.tiangan` / 見下方 |
| `getMonthlySihuaStars(chart,month)` | `getMonthlySihuaStarsJson(chart,month)` | `ziwei.monthlyStars` / `{stars: S[] \| null}` |
| `getDailySihuaStars(chart,y,m,d)` | `getDailySihuaStarsJson(chart,y,m,d)` | `ziwei.dailyStars` / `{stars: S[] \| null}` |
| `getDecadalSihuaStarsAtOffset(chart,offset=0)` | `getDecadalSihuaStarsAtOffsetJson(chart,offset=0)` | `ziwei.decadalStars` / `{result: DecadalResult \| null}` |
| `calculateCrossSihua(chartA,chartB,opts={})` | `calculateCrossSihuaJson({a,b,referenceDate,levels?,month?,targetDate?})` | `cross.sihua` / 上述 CrossData |
| `calculateBazi(y,m,d,hour,gender,minute=0)` | `calculateBaziJson(birth)` | `bazi.chart` / 上述 BaziData |
| `calculateFinance(y,m,d,hour,gender,options={})` | `calculateFinanceJson({...birth,referenceDate?})` | `finance.chart` / 上述 FinanceData |
| `calculateDaily({birth_date,birth_hour=12,gender='男',target_date})` | `calculateDailyJson({...birth,targetDate})` | `daily.chart` / 見下方 |

### Raw 與 JSON 的差別

- chart/finance 的 raw `options` 只接受 `referenceDate`；省略取實際本地日期。JSON chart/finance 同義，其他 JSON 函式的必要日期不可省略。
- raw transit 的 `targetYear` 只改 legacy 年份標籤，不重建盤、不重算流年。要換參考年必須重建 chart，或用要求 `referenceDate` 的 JSON companion。raw `targetMonths` 為斗君序選擇；JSON `months` 預設全部 1..12，明傳須為非空、無重複的整數 1..12 陣列。
- raw transit 含 `_lookup` 函式，不能當純 JSON 傳輸；JSON 版明列省略 `_lookup/summary` 等欄位。不要用 `JSON.stringify(raw)` 靜默吞函式後冒充完整資料。
- raw day/hour 的目標 minute 不參與上游計算。JSON 版另驗證日期及目標時分依存，不接受只有 `targetMinute`。
- raw cross 的 opts 可帶 `levels`、`nameA/nameB`（預設甲方/乙方），以及 `pastDecadalSihua/pastDecadal2Sihua/monthlySihua/dailySihua`（各為 `{a,b}` 星名陣列或缺資料）及相對應的 `pastDecadalLabel/pastDecadal2Label/monthlyLabel/dailyLabel`。raw 不會替這些 extras 計算時間層；JSON 版改從雙盤及日期呼叫原 helpers，且不接受 caller labels 或姓名。
- raw helpers 保留原邊界/null 行為；JSON companions 才驗證 month 整數 1..12、日期及 offset 整數。offset 不保證有對應大限，超出資料範圍為 `null`。三個 helper 的 `input` 分別為 `{chart,month}`、`{chart,targetDate}`、`{chart,offset}`；都不知道 chart 建立時的參考日，因此 envelope `referenceDate: null`，`limitations` 含 `CHART_REFERENCE_DATE_UNKNOWN`。每日 helper 的目標日不冒充 chart 參考日。
- monthly helper 另有 `MONTHS_ARE_DOUJUN_ORDER_NOT_CALENDAR_CONVERSION`；decadal helper 另有 `MISSING_DECADAL_GAN_NORMALIZED_TO_NULL`，僅將缺失的 `gan: undefined` 明確改成 `null`。它們 `omitted` 均為空陣列。
- helpers 的原始陣列/null 放在 `data.stars` 或 `data.result` 內；不直接以陣列/null 冒充 envelope。`DecadalResult = {stars: S[] | null, gan: S | null, zhi: S, startAge: N, endAge: N}`。
- 所有 JSON 輸出先做 lossless JSON 驗證，不以序列化刪除 unsupported values 作為修正。

### TianGan 參考盤

`calculateChartByTianGanJson` 只接受必填 `birthDate/gender`，不接受 `hour/minute`。使用上游 index 0 的參考盤，不是未知時辰的推定結果，也不是「已知出生時間」盤；不能據此宣稱主星/宮位不受時辰影響。

```text
kind = "ziwei.tiangan"
input = { birthDate: DateString, gender: "男" | "女" }
referenceDate = null
data = {
  solarDate: S, lunarDate: S, yearGanZhi: S, yearGan: S,
  gender: "男" | "女", referenceShiChenIdx: 0, yearSiHua: S[],
  starMap: Record<S,{gan: S, stars: S[]}>,
  feiHua: Record<S,{gan: S, sihua: S[]}>
}
omitted = []
limitations = ["INDEX0_REFERENCE_CHART_NOT_KNOWN_BIRTHTIME"]
```

### Root daily（不是第六個 MCP 工具）

`calculateDailyJson` 接受 strict Birth 加必填 `targetDate`；出生時分仍依 Birth 規則驗證，但實際 daily 上游使用分鐘 0。raw daily 使用 snake_case，上游保留的介面可接受未補零日期；JSON companion 僅接受補零日期，且要求明確 `hour/gender`，不能套用 raw 的省略預設。

```text
kind = "daily.chart"
input = { ...Birth, targetDate: DateString }
referenceDate = targetDate
data = {
  ziwei: {
    natal: { mingGong: S, mingGongStars: S[] },
    decadal: DailyPeriodWithOverlay,
    yearly: DailyPeriodWithOverlay,
    monthly: DailyPeriod,
    daily: DailyPeriodWithOverlay
  },
  bazi: {
    natal: { year: S, month: S, day: S, hour: S, dayMaster: S },
    daily: {
      dayPillar: S, monthPillar: S, yearPillar: S, dayNayin: S, lunarDate: S
    },
    interaction: {
      relationCode: S, relationTerm: S,
      natalDayStem?: S, natalElement?: S, dailyStem?: S, dailyElement?: S
    }
  },
  target_date: S, birth_date: S
}
DailyPeriod = { ganZhi: S, mutagen: S[], palaceNames: S[] }
DailyPeriodWithOverlay = DailyPeriod & { dieBenGong: S }
omitted = ["bazi.daily.dayYi", "bazi.daily.dayJi", "bazi.interaction.relation"]
limitations = ["UPSTREAM_DAILY_BIRTH_MINUTE_ZERO"]
```

`relationCode` 為 `SAME`、`NATAL_GENERATES_DAILY`、`DAILY_GENERATES_NATAL`、`NATAL_CONTROLS_DAILY`、`DAILY_CONTROLS_NATAL` 或 `UNKNOWN`；只是五行關係代碼。`UNKNOWN` 分支沒有四個 stem/element 欄位，不輸出解讀句子。

### Formatters、常數及共用 exports

以下函式只回傳事實表格/字串，不回傳 envelope：`formatChart(chart)`、`formatChartCompact(chart)`、`formatChartByTianGan(y,m,d,gender)`、`formatBazi(chart)`、`formatBaziCompact(chart)`、`formatFinance(chart)`。若要 transport 請選對應 JSON calculator，而不是把格式化字串當作可解析資料。

root 亦匯出 `SHI_CHEN_RANGE`、`DI_ZHI`、`TIAN_GAN` 以及底層 `__internals`（cross 的定位/分層 helpers 與表）。它們不是額外 MCP tools。

| 共用函式 | 行為 |
| --- | --- |
| `normalizeBirthInput(input)` | 驗證 strict Birth，補 minute 0，回傳新 object |
| `normalizeDate(value,{allowUnpadded=false}={})` | 驗證公曆日期並回傳補零字串；JSON calculators 不啟用未補零選項 |
| `birthFromParts(year,month,day,hour,gender,minute=0)` | 驗證整數日期組件及 Birth，回傳正規化 Birth；注意 gender 在 minute 前 |
| `assertRecord(value,name='input')` | 要求 plain object，不接受 array/null/其他 prototype |
| `assertKeys(value,keys)` | 拒絕未知 key、symbol、非 enumerable 或 accessor 欄位 |
| `assertJsonData(value)` | 驗證有限數字、dense array、plain object 等可無損 JSON 值；拒絕 undefined/函式/循環/-0 等 |
| `createJsonEnvelope(kind,input,data,{referenceDate=null,omitted=[],limitations=[]}={})` | 建立上面完整 envelope、驗證後回傳 JSON object；沒有替 caller 解讀資料 |

## 保留的北派設定與精度界線

庚干固定為「太陽祿、武曲權、天同科、天相忌」，共享設定的星序是 `['太陽','武曲','天同','天相']`。此設定及流月斗君、流日/流時算術、交叉層級邏輯均保留既有計算；不因包裝成 MCP 而更換門派表或修補上游特殊行為。

固定 `referenceDate` 可重現時間層；沒有明確日期的 chart/finance 呼叫不應只憑 MCP 的 idempotent hint 當成永久固定結果。helper 不知道傳入 raw chart 的日期時會明列未知，不從內容猜測。沒有完整曆年、所有出生組合或分鐘級準確度的驗證承諾。

## 測試：區分完整 gate 與無原檔的 smoke

完整 gate：

```sh
npm test
```

這不只是一般 unit tests：它直接 import 授權且未變更的原始計算檔，做數值/結構 parity、SHA256 before/after 檢查及從原檔於記憶體取得禁止片段的中性掃描。五個原始計算檔的 hashes 與 `tests/fixtures/source-manifest.json` 比對；另外兩個上游測試檔的 hashes 在 parity suite 比對。不是複製一份計算輸出 baseline 作為「原檔」。

公開 checkout 不包含那些原始來源，因此單靠本 repo 不保證 `npm test` 可過；缺少原檔會 fail，不會自動 skip。請只在有授權原檔的環境跑完整 gate，並由呼叫者設定 `DT_SRC_MIRROR` 與 `DT_SRC_API` 為各自來源根目錄，或保留 helper 的預設相對布局（repo 的上兩層下有 `src-mirror/` 與 `src-api/`）：

- mirror 根下需有 `src/ziwei-calc.js`、`src/crosssihua.js`、`src/bazi-calc.js`、`src/finance-calc.js`，及 `test-crosssihua.mjs`、`test-heban-modes.mjs`。
- API 根下需有 `calc-daily.mjs`。
- resolve hook 只替指定原始計算檔的依賴解析指向本 repo 已裝套件；不改寫原始演算法。
- 不要為了變綠而複製私有原檔到公開 repo、替換 hash、建立輸出快照、放寬 parity 或宣稱缺原檔可跳過。

沒有原檔時，可在 checkout 根目錄跑這組自含 smoke/integration：

```sh
node --test tests/index-exports.test.mjs tests/integration.test.mjs tests/mcp-smoke.test.mjs
```

已檢查這三檔及其本地匯入：只用產品、已安裝 dependencies、合成 fixture 與 `fixed-clock.mjs`，不使用 source hooks/integrity/neutral-scan helper、不讀外部原檔。包含真實 stdio 子程序與五工具呼叫，不是 mock；但它不是 direct-original parity，也不能替代完整發布 gate。`test:sol` 腳本仍包含需要原檔的掃描，不可把它誤作無原檔替代方案。

實測覆蓋使用七組合成 births 與四個固定日期 `2024-02-10`、`2025-12-31`、`2026-10-24`、`2027-01-01`。紫微 parity 含每例 12 斗君月、無流時及 24 小時、TianGan index0；cross 以每個 fixture 與下一個環狀配對，檢查雙向八層及歷史缺失，不宣稱測過所有兩兩配對或所有曆日。MCP smoke 檢查 initialization、恰好五工具、三種 overlay scope、cross temporal 層、非法欄位/日期/時分拒絕、stdout JSON-RPC 與子程序清理；另以測試擁有的臨時 symlink 驗證 Node/shebang 啟動的真實 initialization、list、tool call，並清理子程序及臨時目錄。中性掃描是已知片段檢查，不是完整 PII、secret 或語意審查。

測試輸出才是當次通過數的依據；本文件不以舊測試數或單一子集代表最終驗收。直接 Node entry 與測試擁有的 symlink 回歸，也不等於 Claude/Cursor 已在使用者應用程式完成安裝，或 npm-installed bin 已驗證。

## 授權與依賴致謝

本專案附 MIT LICENSE：`Copyright 2026 cph0512 / destinytelling.life`。

以下名稱、版本、MIT 授權與 repository URL 已依本地安裝 metadata 及隨附 LICENSE 核對；不是對遠端最新版本或可用性的網路驗證：

| 直接依賴 | 已安裝版本 | 授權 | Repository |
| --- | --- | --- | --- |
| iztro | 2.6.3 | MIT | https://github.com/SylarLong/iztro.git |
| lunar-javascript | 1.7.7 | MIT | https://github.com/6tail/lunar-javascript.git |
| @modelcontextprotocol/sdk | 1.32.2 | MIT | https://github.com/modelcontextprotocol/typescript-sdk.git |
| zod | 4.6.7 | MIT | https://github.com/colinhacks/zod.git |

感謝 iztro 與 lunar-javascript 提供底層排盤/曆法計算、MCP SDK 提供本機協議傳輸、zod 提供輸入驗證。第三方 copyright 與 MIT 文本見 `NOTICE` 及各套件隨附 LICENSE；直接依賴清單不冒充完整傳遞依賴授權稽核。
