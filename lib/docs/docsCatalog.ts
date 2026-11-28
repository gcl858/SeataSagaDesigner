import { Locale } from '@/lib/saga/i18n';
import { buildZipArchive, ZipEntryInput } from '@/lib/saga/zipBuilder';

export type ArchitectureDiagramId =
  | 'saga-lifecycle'
  | 'yaml-ast-pipeline'
  | 'submachine-stack'
  | 'vscode-bridge'
  | 'layout-routing-pipeline';

export interface DocFigure {
  src: string;
  alt: string;
  caption: string;
  annotations?: Array<{ label: string; detail: string }>;
}

export interface DocTable {
  headers: string[];
  rows: string[][];
}

export interface DocCodeBlock {
  language: string;
  title?: string;
  code: string;
}

export interface DocCallout {
  kind: 'info' | 'tip' | 'warning';
  title: string;
  body: string;
}

export interface DocSection {
  id: string;
  heading: string;
  paragraphs: string[];
  steps?: string[];
  figures?: DocFigure[];
  diagram?: {
    id: ArchitectureDiagramId;
    title: string;
    caption: string;
  };
  table?: DocTable;
  codeBlock?: DocCodeBlock;
  callout?: DocCallout;
}

export interface DocChapter {
  index: string;
  slug: string;
  category: string;
  title: string;
  summary: string;
  readTime: string;
  keywords: string[];
  sections: DocSection[];
}

const CHAPTERS_ZH: DocChapter[] = [
  {
    index: '01',
    slug: '01-getting-started',
    category: '快速入門',
    title: '總覽與快速入門指南',
    summary:
      '認識 Apache Seata Saga State Machine Designer 的完整工作區架構、內建官方範例與 3 分鐘建立第一個分散式事務狀態機的操作流程。',
    readTime: '4 分鐘閱讀',
    keywords: ['快速入門', '介面導覽', '快捷鍵', 'Seata Saga', '範本', '深色模式'],
    sections: [
      {
        id: 'workspace-anatomy',
        heading: '工作區介面導覽',
        paragraphs: [
          'Seata Saga State Machine Designer 採用高效率的四區域桌面工程版面，將視覺化流程設計、屬性檢查、JSON/YAML 雙向編輯、執行補償模擬與 VS Code 擴充整合集中在單一工作區中。',
          '開啟應用程式後，系統會自動載入 Apache Seata 官方經典範例 reduceInventoryAndBalance（庫存與餘額扣減），讓您立即體驗完整的正向流程、條件分支與例外補償拓樸。',
        ],
        figures: [
          {
            src: '/docs/images/01-overview-canvas.png',
            alt: 'Seata Saga State Machine Designer 完整工作區總覽截圖',
            caption:
              '圖 1-1：主工作區介面總覽，包含頂部檢視切換列、工作列、左側狀態節點庫、中央互動畫布與右側屬性檢查器。',
            annotations: [
              {
                label: '頂部導覽列',
                detail:
                  '切換「畫布設計」、「雙欄同步」、「JSON / YAML」、「執行模擬」與「說明文件」，右側提供一鍵「匯出 JSON」。',
              },
              {
                label: '工作列',
                detail:
                  '切換內建範本、檢視目前狀態機名稱與節點數，執行復原/重做、自動排版與模式選單（橫向主幹泳道／精簡簡報／縱向流程）、MiniMax AI 排版、多檔父子匯入與匯出 YAML／SVG、結構驗證、開啟 VS Code 擴充整合，以及切換語系（繁中/EN）與深淺色主題。',
              },
              {
                label: '左側節點庫與邊緣鉗鈕',
                detail:
                  '提供 4 種畫布操作模式與 8 種官方 Seata 狀態節點，支援點擊加入或拖曳至畫布任意座標，並可透過邊緣鉗鈕一鍵收合。',
              },
              {
                label: '右側屬性檢查器',
                detail:
                  '未選取節點時顯示狀態機全域設定（Name、Version、Persist 等）；點選節點或連線時即時切換為對應屬性表單。',
              },
            ],
          },
        ],
      },
      {
        id: 'three-step-quickstart',
        heading: '三步驟建立第一個 Saga 狀態機',
        paragraphs: [
          '無論是從零開始建立新流程，或改寫既有的微服務分散式事務定義，都可依照以下三個步驟快速完成並驗證：',
        ],
        steps: [
          '選擇起始範本：在工作列「範本」下拉選單中，選擇「庫存與餘額扣減」、「訂單履約與子狀態機（多層範例）」或「空白起始範本」。',
          '視覺化編排流程：從左側節點庫拖曳 ServiceTask、Choice、ScriptTask 或 SubStateMachine 至畫布，拖曳節點右側藍色連接點建立 Next / Choice / Catch / CompensateState 連線，並在右側面板填寫 ServiceName、ServiceMethod 與 Input/Output 參數。',
          '驗證、模擬並匯出：點擊工作列「驗證」確認 0 錯誤，切換至「執行模擬」測試失敗與補償回滾路徑，最後匯出為保留完整座標與註解的 YAML 或 JSON 定義檔。',
        ],
      },
      {
        id: 'shortcuts-and-preferences',
        heading: '常用鍵盤快捷鍵與偏好設定',
        paragraphs: [
          '設計器內建與桌面工程工具一致的鍵盤快捷鍵，在非文字輸入狀態下皆可直接觸發：',
        ],
        table: {
          headers: ['快捷鍵 / 控制項', '功能說明', '適用範圍'],
          rows: [
            ['Ctrl + Z / Cmd + Z', '復原上一步畫布或屬性變更（每個子狀態機獨立維護歷史）', '畫布與雙欄模式'],
            ['Ctrl + Y / Shift + Ctrl + Z', '重做已復原的變更', '畫布與雙欄模式'],
            ['Alt + ←', '從 SubStateMachine 子狀態機快速返回上一層父狀態機', '巢狀子狀態機檢視'],
            ['Escape', '取消目前連線模式或關閉開啟中的彈窗', '全域'],
            ['滑鼠滾輪 / 空白拖曳畫布', '平滑縮放畫布（15%–200%）與平移視野，右下角提供適應畫面（完整容納 27+ 節點大型流程）與重設縮放', '畫布區域'],
          ],
        },
      },
    ],
  },
  {
    index: '02',
    slug: '02-canvas-and-states',
    category: '視覺化設計',
    title: '視覺化畫布與 Seata 狀態節點指南',
    summary:
      '深入了解 8 種 Apache Seata 官方狀態節點、4 種流程與補償連線語意、節點快速工具列，以及左右可收合邊緣鉗鈕的高效畫布操作技巧。',
    readTime: '6 分鐘閱讀',
    keywords: ['ServiceTask', 'ScriptTask', 'Choice', 'SubStateMachine', 'CompensationTrigger', '邊緣鉗鈕', '自動排版'],
    sections: [
      {
        id: 'interactive-canvas',
        heading: '互動畫布、快速工具列與可收合左右邊緣鉗鈕',
        paragraphs: [
          '點選畫布上任意狀態節點後，節點右側會出現懸浮式快速操作列，無須切換游標模式即可一鍵延伸下一個 ServiceTask、Choice 分支、綁定補償任務（CompensateState）、接續 Succeed 終點或刪除節點。',
          '當流程圖較寬或在筆電螢幕上作業時，點擊左側節點庫右緣與右側面板左緣的「邊緣鉗鈕」，即可平滑隱藏側欄，將 100% 寬度釋放給中央畫布。',
        ],
        figures: [
          {
            src: '/docs/images/02-canvas-node-selected.png',
            alt: '畫布節點選取狀態、快速延伸工具列與右側屬性編輯面板截圖',
            caption:
              '圖 2-1：點選 ReduceInventory 節點後，顯示懸浮快速操作列、右側 ServiceTask 完整屬性（SpringBean、參數型別、補償任務與 Status Mapping）以及左右面板邊緣鉗鈕。',
          },
        ],
      },
      {
        id: 'eight-state-types',
        heading: '8 種官方 Seata Saga 狀態節點完整對照',
        paragraphs: [
          '設計器完整對齊 Apache Seata STATE_LANG 規範，支援全部 8 類節點與其專屬視覺辨識樣式：',
        ],
        table: {
          headers: ['節點類型', '中文名稱', '核心用途與關鍵屬性'],
          rows: [
            ['StartState', '起始事件', '標示整個狀態機的進入點，對應頂層 StartState 屬性；每個狀態機僅允許一個起始節點。'],
            ['ServiceTask', '微服務任務', '呼叫遠端或本地微服務（SpringBean / Dubbo / SofaRPC），支援 CompensateState、Input/Output、Status Mapping、Retry 與 Catch。'],
            ['ScriptTask', '內嵌腳本', '執行 Groovy 等內嵌運算腳本（ScriptType、ScriptContent），常用於風控評分、規則計算或資料轉換。'],
            ['Choice', '條件閘道', '依 SpEL 條件運算式（Choices[]）將流程導向不同分支，並支援 Default 預設路徑。'],
            ['SubStateMachine', '子狀態機', '以 StateMachineName 委派呼叫另一組獨立 Saga 狀態機；支援畫布雙擊直接鑽取編輯與跨層補償。'],
            ['CompensationTrigger', '觸發補償', '接收失敗或例外路徑後，通知 Seata 引擎以 LIFO（後進先出）順序反向補償所有已成功的任務。'],
            ['Succeed', '成功終止', '標記分散式事務順利完成並提交結束狀態。'],
            ['Fail', '失敗終止', '標記流程異常終止，可設定 ErrorCode 與 Message 供上游系統識別。'],
          ],
        },
      },
      {
        id: 'four-edge-types',
        heading: '4 種連線語意、360° 動態 Catch 錨點與自動拓樸排版',
        paragraphs: [
          '畫布底部圖例清楚區分流程中的 4 種連線語意：實線灰藍箭頭代表一般順序轉移（Next）或條件分支（Choice / Default）；紫色虛線代表補償綁定（CompensateState）；橘色點線代表例外捕獲（Catch）。',
          '所有 Catch 例外連線皆內建 360° 動態邊界追蹤：系統會依目標節點方位自動將橘色圓形錨點貼齊來源節點的上、右、下、左四個邊界並主動避開同側的 Next 與 Compensate 連線；使用者亦可直接拖曳該橘色錨點沿著節點四邊任意釘選（寫入 style.sourceAnchor），雙擊錨點或於右側屬性面板即可一鍵恢復自動追蹤。',
          '若手動拖曳後連線交錯，隨時點擊工作列「自動排版」按鈕（或展開右側下拉選單切換「橫向主幹泳道」、「精簡簡報排版」、「縱向泳道流程」），多層語意演算法會自動對齊正向主幹、將補償與回滾鏈分層排列，並搭配無遮擋圓角通道繞道消除所有節點重疊與連線穿越（詳見第 09 章）。',
        ],
        callout: {
          kind: 'tip',
          title: '快速建立補償任務的小技巧',
          body: '選取任何 ServiceTask 後，直接點擊節點右側懸浮工具列的「紫色回轉箭頭」圖示，設計器會自動在正下方建立已勾選 IsForCompensation 的補償 ServiceTask 並完成 CompensateState 連線綁定。',
        },
      },
    ],
  },
  {
    index: '03',
    slug: '03-split-view-sync',
    category: '雙欄同步',
    title: '雙欄同步與行號閃爍定位',
    summary:
      '同時開啟視覺化畫布與 JSON/YAML 程式碼面板，體驗點選節點或連線時自動捲動至精確行號並以特效閃爍標示區塊的流暢工作流。',
    readTime: '4 分鐘閱讀',
    keywords: ['雙欄同步', 'Split View', '行號定位', '閃爍高亮', 'JSON', 'YAML'],
    sections: [
      {
        id: 'click-to-flash',
        heading: '點選畫布即時定位與區塊閃爍特效',
        paragraphs: [
          '切換至頂部導覽列的「雙欄同步」後，右側面板會展開具備同步行號列（Line Gutter）的程式碼編輯器，支援在 JSON 與 YAML 之間隨時切換。',
          '當您在左側畫布點擊任何狀態節點（例如 ReduceBalance）或任一條轉移／補償／例外連線時，底層的 Source Locator 會精確計算該元素在目前原始碼中的起始與結束行號，在 240 毫秒內平滑捲動至視窗中央，並以藍色光暈區塊閃爍提示，同時於頂部列顯示精確範圍標籤（例如 ReduceBalance · L59-88）。',
        ],
        figures: [
          {
            src: '/docs/images/03-split-view-flash.png',
            alt: '雙欄同步模式點擊 ReduceBalance 節點並自動捲動至 YAML L59-88 行閃爍高亮截圖',
            caption:
              '圖 3-1：雙欄同步模式下點擊畫布中的 ReduceBalance 節點，右側 YAML 面板自動跳轉至 L59-88 行並觸發藍色區塊閃爍高亮。',
          },
        ],
      },
      {
        id: 'bidirectional-editing',
        heading: '雙向同步與 style.bounds 座標控制',
        paragraphs: [
          '在畫布上拖曳節點、修改屬性或連線時，右側 JSON/YAML 會即時反映最新結構；反之，當您直接在右側編輯器修改原始碼時，「套用變更至畫布」按鈕會亮起，點擊後即可即時解析並重繪畫布。',
          '頂部的「包含畫布座標 (style)」核取方塊可控制輸出是否保留每個節點的 style.bounds（x、y、width、height）資訊：開發設計期建議保持勾選以保留排版，部署至極簡執行環境時可取消勾選以產出純語意定義檔。',
        ],
        callout: {
          kind: 'info',
          title: '支援點選連線定位特定欄位',
          body: '不僅是節點，點擊畫布上的 Choice 條件標籤、Compensate 紫色虛線或 Throwable 橘色例外線時，右側程式碼會直接跳轉並高亮對應的 Choices、CompensateState 或 Catch 區段行號。',
        },
      },
    ],
  },
  {
    index: '04',
    slug: '04-yaml-comments',
    category: 'YAML 工程化',
    title: 'YAML 匯入匯出與 # 註解保留技術',
    summary:
      '了解設計器如何透過 YAML v2 AST 樹狀結構對齊機制，在視覺化拖曳、屬性修改與節點重命名過程中完整保留所有 # 註解說明。',
    readTime: '5 分鐘閱讀',
    keywords: ['YAML', '註解保留', 'AST', '匯入', '匯出', '格式化'],
    sections: [
      {
        id: 'comment-preservation-demo',
        heading: '匯入、編輯並完整保留所有 # 註解',
        paragraphs: [
          '實務上團隊經常在 Seata Saga YAML 設定檔中撰寫豐富的業務說明、風控門檻理由與維運聯絡註解。傳統「JSON.parse → YAML.stringify」流程會無條件丟棄所有 # 註解，導致視覺化工具難以融入 Git 團隊協作。',
          '本設計器採用基於 AST（抽象語法樹）的無損調和演算法：無論是檔案表頭註解、區塊前註解（commentBefore）、行尾註解（inline # comment）、陣列項目註解或檔尾註解，在畫布進行節點拖曳、調整 Catch 邊界錨點（style.sourceAnchor）或重新命名後重新匯出 YAML 時，全部都會精準保留於對應位置。同時支援以 --- 分隔的多文件 YAML 一次批次匯入，且每份文件皆獨立保存各自的註解範本。',
        ],
        figures: [
          {
            src: '/docs/images/04-yaml-comments-editor.png',
            alt: 'YAML 編輯器中完整保留表頭註解、行尾註解與節點區塊註解的截圖',
            caption:
              '圖 4-1：於 JSON/YAML 檢視中匯入含表頭註解、StartState 行尾註解與 ReduceInventory 區塊註解的 YAML，點擊「套用變更至畫布」後註解結構完全保留。',
          },
        ],
      },
      {
        id: 'ast-pipeline-diagram',
        heading: 'YAML AST 註解保留調和管線原理',
        paragraphs: [
          '每次匯入或套用 YAML 時，系統除了將其轉換為視覺化圖形模型（SagaGraph）外，還會將原始 YAML 文本快照保存為 yamlTemplate。當使用者在畫布上修改節點或重新命名狀態時，序列化器會重新解析 yamlTemplate 的 Document AST，僅針對實際變動的鍵值進行就地更新或鍵名遷移，從而完整守住每一個註解節點與原本的屬性順序。',
        ],
        diagram: {
          id: 'yaml-ast-pipeline',
          title: 'YAML v2 AST 註解無損調和管線',
          caption:
            '架構圖 4-1：YAML 原始碼同時建立視覺圖形與 AST 註解範本，經畫布編輯與重命名調和後輸出無損註解的 .saga.yaml。',
        },
      },
      {
        id: 'yaml-example',
        heading: '支援註解保留的 Seata Saga YAML 範例',
        paragraphs: [
          '您可以直接複製以下含完整註解的 YAML 範例貼入「JSON / YAML」檢視，或存檔為 .saga.yaml 透過工作列「匯入 JSON/YAML」載入測試：',
        ],
        codeBlock: {
          language: 'yaml',
          title: 'orderInventory.saga.yaml',
          code: `# Apache Seata Saga 庫存與餘額扣減流程
# 團隊規範：所有正向 ServiceTask 均需綁定 CompensateState
Name: reduceInventoryAndBalance
Comment: Reduce inventory then reduce balance
StartState: ReduceInventory # 流程起始節點
Version: 1.0.0
Type: STATE_LANG
Persist: true
States:
  # 步驟 1：扣減商品庫存（失敗時由 CompensateReduceInventory 回補）
  ReduceInventory:
    Type: ServiceTask
    ServiceName: inventoryAction
    ServiceMethod: reduce
    ServiceType: SpringBean
    CompensateState: CompensateReduceInventory # 綁定補償節點
    Input:
      - $. [businessKey] # 訂單唯一業務鍵
      - $. [count]       # 購買數量
    Next: Succeed`,
        },
      },
    ],
  },
  {
    index: '05',
    slug: '05-sub-state-machine',
    category: '進階巢狀流程',
    title: '多層 SubStateMachine 巢狀子狀態機鑽取',
    summary:
      '透過內建三層巢狀範例（訂單履約 → 支付結算 → 反詐欺驗證），掌握雙擊進入子狀態機、麵包屑返回父層、循環參考防護與獨立復原歷史的完整機制。',
    readTime: '6 分鐘閱讀',
    keywords: ['SubStateMachine', '子狀態機', '雙擊鑽取', '返回父狀態機', '麵包屑', '循環防護'],
    sections: [
      {
        id: 'parent-drilldown',
        heading: '雙擊 SubStateMachine 節點直接進入子狀態機',
        paragraphs: [
          '大型分散式事務往往需要模組化拆分。請在工作列「範本」切換至「訂單履約與子狀態機（多層範例）」，您會在主流程 orderFulfillmentSaga 中看到天藍色雙層卡片樣式的 PaymentSubMachine（SubStateMachine）節點。',
          '只要在畫布上「雙擊」PaymentSubMachine 節點，或是點選該節點後點擊右側屬性面板中的「進入子狀態機」按鈕（亦可使用節點快速工具列最上方的資料夾圖示），畫布就會立即切換並載入對應的 paymentSettlementSubSaga 子狀態機。',
        ],
        figures: [
          {
            src: '/docs/images/05-submachine-parent.png',
            alt: 'orderFulfillmentSaga 父狀態機中選取 PaymentSubMachine 子狀態機節點的截圖',
            caption:
              '圖 5-1：在頂層 orderFulfillmentSaga 選取 PaymentSubMachine 節點，右側面板即時顯示已連結工作區子狀態機（9 節點）與「進入子狀態機」入口。',
          },
        ],
      },
      {
        id: 'breadcrumb-return',
        heading: '多層導覽麵包屑與返回父狀態機機制',
        paragraphs: [
          '進入子狀態機後，工作列下方會自動浮現清晰的層級導覽列（Breadcrumb），顯示完整呼叫路徑（例如 orderFulfillmentSaga > paymentSettlementSubSaga (PaymentSubMachine)）與目前深度（層級 2）。',
          '在 Level 2 的 paymentSettlementSubSaga 中還包含第三層子狀態機節點 FraudSubCheck（指向 fraudVerificationSubSaga），支援繼續雙擊深入至層級 3。隨時點擊左側「返回父狀態機」按鈕、點擊麵包屑中的任意父層名稱，或按下快捷鍵 Alt + ←，皆可瞬間返回父狀態機並自動選取原本進入的 SubStateMachine 節點，確保上下文不遺失。',
        ],
        figures: [
          {
            src: '/docs/images/05-submachine-level2.png',
            alt: '雙擊進入 paymentSettlementSubSaga 子狀態機後顯示返回父狀態機麵包屑與第三層 FraudSubCheck 的截圖',
            caption:
              '圖 5-2：已進入層級 2 的 paymentSettlementSubSaga，頂部提供「返回父狀態機」按鈕與層級麵包屑，畫布內可繼續雙擊 FraudSubCheck 進入層級 3 反詐欺驗證流程。',
          },
        ],
      },
      {
        id: 'submachine-architecture',
        heading: '三層狀態機呼叫堆疊與安全防護設計',
        paragraphs: [
          '為了在真實企業場景中確保多層編排安全可靠，工作區管理引擎（subMachines）實作了四項核心保障：',
        ],
        diagram: {
          id: 'submachine-stack',
          title: '三層 SubStateMachine 呼叫堆疊與防護機制',
          caption:
            '架構圖 5-1：orderFulfillmentSaga → paymentSettlementSubSaga → fraudVerificationSubSaga 三層呼叫鏈、獨立復原歷史與循環參考防護。',
        },
        steps: [
          '自動鷹架建立（Auto-Scaffolding）：若雙擊一個尚未定義對應子流程的 SubStateMachine，系統會自動建立含起始點、主服務任務、補償任務與 Succeed 終點的標準子狀態機，無須手動從頭建檔。',
          '循環參考偵測與阻斷：無論是自我呼叫（A → A）或跨層環狀參考（A → B → A），系統都會在雙擊進入與結構驗證階段即時阻斷並發出錯誤提示。',
          '每層獨立 Undo / Redo 歷史：在子狀態機按 Ctrl+Z 只會復原子狀態機本身的編輯，絕不誤刪父狀態機節點。',
          '子狀態機更名連動：在子狀態機修改全域 Name 後，返回父層時其對應節點的 StateMachineName 會自動同步更新。',
        ],
      },
      {
        id: 'batch-import-parent-child',
        heading: '多檔父子流程批次匯入與實務專案範例',
        paragraphs: [
          '點擊工作列「匯入 JSON/YAML」時，可一次選取最多 30 個父子流程檔案（支援 .yaml、.yml、.json、多文件 YAML --- 與 JSON 陣列）。系統會忽略選檔順序，自動依據 SubStateMachine 的 StateMachineName 依賴圖識別頂層父狀態機並串聯所有子狀態機，並在工作列下方顯示天藍色「多檔父子匯入」快速切換列（標示「父」、「子」、「獨立」），同時即時回報缺少的子流程參照、重複命名或部分語法錯誤。',
          '專案內建 examples/omni-cash-transaction/ 真實實務範例組（包含父流程 omni_cash_transaction.saga.yaml 與兩個子流程 repayment_cash_deposit.saga.yaml、repayment_cash_cancellation.saga.yaml），一次全選匯入即可體驗自動父子連結、雙擊鑽取與多層語意自動排版。',
        ],
        figures: [
          {
            src: '/docs/images/09-auto-layout-omni-menu.png',
            alt: '一次匯入三支 omni-cash-transaction 父子 YAML 檔案後顯示多檔父子切換列與自動排版模式選單的截圖',
            caption:
              '圖 5-3：一次匯入三支臨櫃現金繳款 YAML 檔案後，頂部自動建立「父 omni_cash_transaction」與兩個子狀態機快速切換按鈕，無須額外設定即可雙擊鑽取。',
          },
        ],
      },
    ],
  },
  {
    index: '06',
    slug: '06-validation-and-simulation',
    category: '驗證與模擬',
    title: '拓樸驗證與分散式事務補償模擬',
    summary:
      '使用即時 Seata 規範診斷抽屜與互動式執行模擬器，在部署至正式微服務叢集前完整演練成功提交、異常捕獲（Catch）與 LIFO 反向補償流程。',
    readTime: '5 分鐘閱讀',
    keywords: ['驗證', 'Validation', '模擬器', 'LIFO 補償', 'CompensationTrigger', 'Catch', '單步前進'],
    sections: [
      {
        id: 'lifo-simulation',
        heading: '互動式執行模擬與 LIFO 補償鏈演練',
        paragraphs: [
          '切換至頂部「執行模擬」檢視後，您可以自訂初始 JSON 上下文參數（例如 businessKey、count、amount），並為每個 ServiceTask、ScriptTask 與 SubStateMachine 設定模擬回傳結果：SU（成功）、FA（業務失敗）或 Throw Exception（拋出例外）。',
          '例如在 reduceInventoryAndBalance 中將 ReduceBalance 設為 Throw Exception 後點擊「執行完整模擬」，模擬器會完整走訪 Start → ReduceInventory（註冊補償）→ ChoiceState → ReduceBalance（拋出例外）→ Catch → CompensationTrigger → CompensateReduceInventory（LIFO 反向補償）→ Fail，並在畫布上以綠、琥珀、紫、紅高亮即時標示每一步狀態。',
        ],
        figures: [
          {
            src: '/docs/images/06-simulation-compensation.png',
            alt: 'Saga 執行模擬器模擬 ReduceBalance 拋出例外並觸發補償軌跡的截圖',
            caption:
              '圖 6-1：將 ReduceBalance 設為 Throw Exception 執行完整模擬後，畫布即時著色顯示執行與捕獲路徑，右側完整列出逐步執行與補償軌跡（COMPENSATED）。',
          },
        ],
      },
      {
        id: 'saga-lifecycle-diagram',
        heading: 'Seata Saga 正向執行與 LIFO 反向補償生命週期',
        paragraphs: [
          '模擬器亦支援「單步前進」逐一檢視每一個節點執行前後的 Context 變數變化，並且針對多層 SubStateMachine 提供遞迴子流程模擬，在執行軌跡中清楚顯示跨層的執行與補償步驟。',
        ],
        diagram: {
          id: 'saga-lifecycle',
          title: 'Seata Saga 正向推進與 LIFO 補償執行流程',
          caption:
            '架構圖 6-1：正向任務每成功一步即推入補償堆疊；當後續任務拋出例外經 Catch 導向 CompensationTrigger 時，引擎依後進先出順序依序執行補償任務。',
        },
      },
      {
        id: 'validation-drawer',
        heading: '即時語法與結構診斷抽屜',
        paragraphs: [
          '點擊工作列上的「驗證 (錯誤數/警告數)」按鈕，畫布下方會展開即時診斷清單。點擊清單中任一錯誤或警告項目，系統會自動選取並聚焦於問題節點或連線，協助快速修正。',
        ],
        figures: [
          {
            src: '/docs/images/06-validation-drawer.png',
            alt: '畫布底部展開狀態機語法與結構驗證抽屜顯示零錯誤通過狀態的截圖',
            caption:
              '圖 6-2：驗證抽屜即時檢核狀態機拓樸完整性，零錯誤與警告時顯示綠色通過提示。',
          },
        ],
        table: {
          headers: ['診斷代碼', '嚴重程度', '檢核條件說明'],
          rows: [
            ['NO_START_STATE', 'Error', '狀態機缺少 StartState 起始節點，或 StartState 尚未連接至第一個任務。'],
            ['MISSING_SERVICE_META', 'Error', 'ServiceTask 缺少必填的 ServiceName 或 ServiceMethod 欄位。'],
            ['EMPTY_SCRIPT', 'Error', 'ScriptTask 缺少可執行的 ScriptContent 腳本內容。'],
            ['SUBMACHINE_SELF_CYCLE', 'Error', 'SubStateMachine 的 StateMachineName 指向目前狀態機本身形成無限遞迴。'],
            ['UNRESOLVED_SUBMACHINE', 'Warning', 'SubStateMachine 參考的目標子狀態機尚未在工作區建立定義檔。'],
            ['UNREACHABLE_STATE', 'Warning', '畫布上存在無法由 StartState 到達且非補償用途的孤立節點。'],
          ],
        },
      },
    ],
  },
  {
    index: '07',
    slug: '07-vscode-extension',
    category: 'IDE 擴充整合',
    title: 'VS Code 瀏覽器版與桌面版擴充套件整合',
    summary:
      '一鍵下載免編譯、零 Node.js 依賴的通用 VS Code Web Extension，直接在 vscode.dev、github.dev、Codespaces 與桌面版 VS Code 中視覺化編輯 Saga 檔案。',
    readTime: '6 分鐘閱讀',
    keywords: ['VS Code', 'vscode.dev', 'github.dev', 'Web Extension', 'CustomTextEditorProvider', 'Webview Bridge'],
    sections: [
      {
        id: 'download-and-install',
        heading: '一鍵下載即用型 VS Code Web Extension',
        paragraphs: [
          '點擊工作列右側的「VS Code 擴充」按鈕，即可開啟擴充套件整合視窗。系統會自動帶入目前應用程式的 Hosted Designer URL，並即時打包零 Node.js 依賴的通用擴充套件（seata-saga-vscode-web-extension.zip）。',
          '解壓縮後的套件同時宣告 "browser": "./dist/web/extension.js" 與 "main": "./dist/web/extension.js"，全程採用 vscode.workspace.fs 與 Webview API，無須安裝任何 npm 依賴即可直接在瀏覽器版與桌面版 VS Code 執行。',
        ],
        figures: [
          {
            src: '/docs/images/07-vscode-modal-install.png',
            alt: 'VS Code Web & Desktop 擴充套件整合彈窗顯示 URL 設定、一鍵下載與三種啟動指令的截圖',
            caption:
              '圖 7-1：VS Code 擴充套件整合視窗提供 Hosted URL 設定、預設格式選擇、一鍵下載 .zip 與 3 種免編譯啟動／打包指令。',
          },
        ],
        codeBlock: {
          language: 'bash',
          title: '三種快速啟動與安裝方式',
          code: `# 1. 直接在瀏覽器版 VS Code 測試（免編譯、最快體驗）
npx @vscode/test-web --browserType=chromium --extensionDevelopmentPath=./seata-saga-vscode-web

# 2. 載入至 vscode.dev / github.dev（啟動 CORS 靜態伺服器後於 vscode.dev 按 F1 → Developer: Install Web Extension）
npx serve --cors ./seata-saga-vscode-web

# 3. 打包成 .vsix 安裝至桌面版 VS Code 或發佈至 Visual Studio Marketplace
cd seata-saga-vscode-web && npx @vscode/vsce package --target web && code --install-extension seata-saga-designer-1.0.0.vsix`,
        },
      },
      {
        id: 'live-webview-bridge',
        heading: 'VS Code Webview 實機模擬與雙向通訊協定',
        paragraphs: [
          '在未安裝到 VS Code 之前，您可以直接切換至彈窗的第三個分頁「VS Code Webview 實機模擬」，立即在瀏覽器內體驗完整的 VS Code Host 雙向同步行為：左側模擬 VS Code TextDocument 原始碼、Problems 診斷面板與即時 postMessage 訊號紀錄，右側則以真實 ?embed=vscode 模式掛載本設計器。',
          '當您在右側視覺畫布點擊任意節點（如 PaymentSubMachine）時，上方宿主狀態列會立即顯示 Reveal PaymentSubMachine (L78-98)，代表在真實 VS Code 中已同步將並排文字編輯器捲動並閃爍高亮第 78–98 行。',
        ],
        figures: [
          {
            src: '/docs/images/07-vscode-live-bridge.png',
            alt: 'VS Code Webview 實機模擬分頁顯示 orderFulfillment.saga.yaml、Reveal 行號同步與 postMessage 紀錄的截圖',
            caption:
              '圖 7-2：內建 VS Code Webview 實機模擬介面，展示深色主題同步、窄窗自動收合左側節點庫、即時 Problems 診斷與點擊節點觸發行號定位。',
          },
        ],
      },
      {
        id: 'vscode-bridge-diagram',
        heading: '雙環境 Host Bridge 安全架構與設定項目',
        paragraphs: [
          '擴充套件在 Webview 內強制啟用嚴格 Content-Security-Policy，僅允許 https:// 與 http://localhost 來源載入設計器，並透過明確的 Origin 驗證雙向轉發 postMessage 訊息。於工作區開啟 *.saga.yaml / *.saga.json 時會自動掃描同專案子狀態機，支援原生 Ctrl+S 存檔、Ctrl+Z 復原與 Git Diff 檢視。',
        ],
        diagram: {
          id: 'vscode-bridge',
          title: 'VS Code Web / Desktop 雙環境 Webview Bridge 架構',
          caption:
            '架構圖 7-1：VS Code Extension Host 透過 CustomTextEditorProvider 與 CSP 驗證中繼層，與 Next.js 設計器完成雙向檔案、子狀態機與診斷同步。',
        },
        table: {
          headers: ['VS Code 設定項', '預設值', '功能說明'],
          rows: [
            ['seataSaga.designerUrl', '當前應用程式網址', '指定 Webview 載入的 Seata Saga Designer 託管網址（僅接受 https 或 localhost）。'],
            ['seataSaga.defaultFormat', 'yaml', '建立新狀態機或自動建立子狀態機檔案時的預設格式（yaml 或 json）。'],
            ['seataSaga.syncDiagnostics', 'true', '是否將即時拓樸驗證錯誤與警告同步顯示至 VS Code「問題（Problems）」面板。'],
            ['seataSaga.autoScanSubMachines', 'true', '是否自動掃描工作區內的 *.saga.* 檔案以支援跨檔 SubStateMachine 雙擊鑽取。'],
          ],
        },
      },
    ],
  },
  {
    index: '08',
    slug: '08-schema-and-faq',
    category: '規格參考',
    title: 'Seata STATE_LANG 規格參考與常見問題',
    summary:
      'Apache Seata Saga STATE_LANG JSON / YAML 核心欄位總表、Input/Output 參數表達式語法速查，以及匯入、註解保留與 VS Code 部署常見問題解答。',
    readTime: '5 分鐘閱讀',
    keywords: ['STATE_LANG', 'Schema', 'JSONPath', 'SpEL', 'Retry', 'Status', 'FAQ', '常見問題'],
    sections: [
      {
        id: 'top-level-schema',
        heading: '狀態機頂層與任務欄位規格總表',
        paragraphs: [
          '以下整理本設計器完整支援並可雙向序列化至 JSON 與 YAML 的 Apache Seata Saga 核心屬性：',
        ],
        table: {
          headers: ['欄位名稱', '層級', '型別', '說明'],
          rows: [
            ['Name', '頂層', 'string', '狀態機全域唯一識別名稱，亦作為 SubStateMachine 呼叫時的參照鍵。'],
            ['StartState', '頂層', 'string', '流程啟動後第一個執行的 State 名稱。'],
            ['Version', '頂層', 'string', '狀態機語意版本號（例如 0.0.1 或 1.2.0）。'],
            ['Type', '頂層', 'string', '固定為 STATE_LANG，代表 Apache Seata 狀態語言規範。'],
            ['Persist', '頂層', 'boolean', '是否將狀態機執行與補償日誌持久化至 Seata Server 資料庫。'],
            ['ServiceName / ServiceMethod', 'ServiceTask', 'string', '目標 SpringBean、Dubbo 或 SofaRPC 服務名稱與方法簽章。'],
            ['CompensateState', 'Task / SubMachine', 'string', '對應補償狀態名稱，該目標節點須設定 IsForCompensation: true。'],
            ['Input / Output', 'Task / SubMachine', 'array / object', '從上下文提取參數（$.[key]）與寫回執行結果（$.#root）的映射規則。'],
            ['Status', 'ServiceTask', 'object', '依據回傳值或例外動態判定 SU（成功）、FA（失敗）或 UN（未知）。'],
            ['Catch / Retry', 'Task / SubMachine', 'array', '定義例外類別捕獲轉移目標（Next）與指數退避重試策略（IntervalSeconds、MaxAttempts、BackoffRate）。'],
            ['style.bounds / style.sourceAnchor', '設計器視覺中繼', 'object', '保存節點座標尺寸（x、y、width、height）與手動釘選之 Catch 錨點（side、ratio）；關閉「包含畫布座標 (style)」時會自動清除。'],
          ],
        },
      },
      {
        id: 'env-and-deployment',
        heading: '伺服器環境變數與部署設定（.env.example）',
        paragraphs: [
          '若於自架環境啟用 MiniMax AI 語意排版或建置 GitHub Pages 靜態網站，可依以下環境變數表設定伺服器端機密與建置旗標（API 金鑰僅存在伺服器端，絕不暴露至瀏覽器）：',
        ],
        table: {
          headers: ['環境變數', '用途', '預設值 / 說明'],
          rows: [
            ['MINIMAX_API_KEY', 'MiniMax AI 排版驗證金鑰', '選填；設定後啟用 /api/saga/ai-layout（未設定時仍可使用完整本機自動排版）。'],
            ['MINIMAX_BASE_URL', 'MiniMax API 端點位址', '預設 https://api.minimax.io/v1（僅允許白名單 HTTPS 主機，防止 SSRF）。'],
            ['MINIMAX_MODEL', 'AI 排版預設模型', '預設 MiniMax-M3.1-Flash，亦支援 MiniMax-M3 與 MiniMax-M2.5。'],
            ['BUILD_TARGET', 'Next.js 靜態輸出切換', '設為 github-pages 時啟用靜態匯出模式（output: export）。'],
            ['GITHUB_PAGES_BASE_PATH', '子路徑部署前綴', '例如 /seata-saga-designer，供靜態資源與圖片路徑自動套用 basePath。'],
          ],
        },
      },
      {
        id: 'expression-cheatsheet',
        heading: 'Input / Output 與 Choice 表達式速查',
        paragraphs: [
          '在 Seata Saga 與本設計器的內建模擬器中，常用的上下文取值與條件判斷語法如下：',
        ],
        codeBlock: {
          language: 'yaml',
          title: '常用參數映射與條件判斷語法',
          code: `# Input：從流程上下文（Context）擷取欄位傳入服務方法
Input:
  - "$.[businessKey]"
  - "$.[amount]"

# Output：將服務回傳值（#root）寫回流程上下文指定變數
Output:
  reduceInventoryResult: "$.#root"

# Choice Expression：於條件閘道評估上下文布林或數值比較
Choices:
  - Expression: "[reduceInventoryResult] == true"
    Next: ReduceBalance
  - Expression: "[riskScore] < 80"
    Next: PaymentSubMachine
Default: Fail`,
        },
      },
      {
        id: 'faq',
        heading: '常見問題排除（FAQ）',
        paragraphs: [
          '以下彙整團隊在設計流程、維護 YAML 註解、使用自動／AI 排版與部署 VS Code Web Extension 時最常遇到的問題與建議解法：',
        ],
        table: {
          headers: ['常見問題', '解決方式'],
          rows: [
            [
              '匯入舊版純 JSON/YAML 沒有 style.bounds 座標，節點重疊或大型流程被裁切怎麼辦？',
              '載入無座標檔案時系統會自動套用多層語意泳道排版；您也可點擊工作列「自動排版 ▾」切換「精簡簡報排版」或「縱向泳道流程」，並使用最低支援至 15% 的「適應畫面」完整檢視 27+ 節點流程。',
            ],
            [
              '如何調整 Catch 例外連線在起始節點上的出線位置，或恢復自動追蹤？',
              '直接拖曳節點邊框上的橘色圓形 Catch 錨點即可沿四個邊界自由釘選位置（亦可在右側屬性面板選擇上／右／下／左與比例）；雙擊橘色錨點或點擊「自動排版」即可恢復 360° 自動追蹤。',
            ],
            [
              '點擊「AI 排版」提示尚未設定 MINIMAX_API_KEY 或請求等待時間較長怎麼辦？',
              '請於伺服器環境變數或 Settings > Secrets 設定 MINIMAX_API_KEY；AI 排版支援最高 300 秒逾時上限、即時經過時間計時與中途取消，未設定金鑰時可直接使用同樣支援零遮擋通道繞道的本機「自動排版」。',
            ],
            [
              '為什麼某些編輯操作後想確認 YAML 註解是否仍完整保留？',
              '只要原始檔以 YAML 格式匯入或套用，系統就會保存 AST 範本；切換至「雙欄同步」並選擇 YAML 即可即時檢視所有表頭、行內與區塊 # 註解。',
            ],
            [
              '在雙擊 SubStateMachine 時跳出循環參考提示是什麼意思？',
              '代表該節點的 StateMachineName 直接或間接指向了目前呼叫鏈中的父狀態機，為避免無限遞迴系統已自動阻斷，請修改 StateMachineName 指向正確子流程。',
            ],
            [
              '在 vscode.dev 載入 Web Extension 時無法連線設計器怎麼辦？',
              '請確認 VS Code 設定 seataSaga.designerUrl 為有效的 HTTPS 位址（本機測試可使用 http://localhost:3000），且該部署網址允許被瀏覽器 iframe 內嵌。',
            ],
          ],
        },
      },
    ],
  },
  {
    index: '09',
    slug: '09-auto-layout-and-ai',
    category: '排版與繞道引擎',
    title: '多層語意自動排版、360° Catch 錨點與 AI 排版',
    summary:
      '深入掌握針對大型實務 Seata Saga 流程設計的五層語意泳道自動排版、360° 可拖曳 Catch 邊界錨點、無遮擋圓角通道繞道，以及整合 MiniMax 模型的 AI 智慧語意排版。',
    readTime: '6 分鐘閱讀',
    keywords: [
      '自動排版',
      '語意泳道',
      'Catch 錨點',
      'sourceAnchor',
      '通道繞道',
      'AI 排版',
      'MiniMax',
      '300秒逾時',
      '取消機制',
    ],
    sections: [
      {
        id: 'semantic-swimlane-layout',
        heading: '五層語意泳道自動排版與三種內建模式',
        paragraphs: [
          '針對真實企業級分散式交易（如 27 個節點、44 條連線的臨櫃現金取消流程 repayment_cash_cancellation.saga.yaml），傳統最短路徑 BFS 排版容易讓共用的 Succeed 終點卡在畫布中央、造成大量回頭箭頭與長連線穿越節點。',
          '全新自動排版引擎（lib/saga/autoLayout.ts）改採無環 DAG 最長路徑分欄與五層語意泳道架構：自動將主流程置中為 0px 水平中軸（Band 0），將逾時／對帳查詢／診斷分流上移至上層泳道（Band -1），將配對的 CompensateState 補償任務精準垂直對齊於原任務正下方並搭配直接拒單處理（Band +1），並將 CompensationTrigger 回滾鏈（Band +2）與補償失敗告警／Fail 終點（Band +3）分層排列；Succeed 終點恆定置於最末端，確保零節點重疊、零逆向回頭連線、零連線穿過節點與零標籤遮擋。',
          '點擊工作列「自動排版」按鈕可立即以目前選用模式重排並自動適應畫面；點擊右側下拉箭頭可快速切換三種風格：「橫向主幹泳道（預設）」、「精簡簡報排版」（壓縮寬圖欄距，適合大型流程全覽與文件截圖）與「縱向泳道流程」（由上而下主軸展開，動態計算節點標籤高度避免擁擠）。',
        ],
        figures: [
          {
            src: '/docs/images/09-auto-layout-large-cancellation.png',
            alt: '27 節點 44 連線的 repayment_cash_cancellation 實務流程套用多層語意泳道自動排版後的完整畫布截圖',
            caption:
              '圖 9-1：27 個節點、44 條連線的 repayment_cash_cancellation 實務取消流程，經五層語意泳道排版與圓角通道匯流排繞道後，於 21% 縮放完整呈現在畫布內（0 節點重疊、0 連線穿越、0 逆向連線）。',
          },
        ],
        diagram: {
          id: 'layout-routing-pipeline',
          title: '四階段自動排版與無遮擋通道繞道管線',
          caption:
            '架構圖 9-1：從語意泳道分類、DAG 最長路徑分欄，到 360° Catch 動態錨點、圓角通道匯流排與零碰撞標籤定位的完整管線。',
        },
      },
      {
        id: 'catch-anchor-and-corridors',
        heading: '360° 動態 Catch 邊界錨點與無遮擋圓角通道繞道',
        paragraphs: [
          '過去 Catch 例外連線僅固定從來源節點下緣出發，拖曳目標節點至右側或上方時容易拉出橫越節點本體的雜亂線段。現在系統會即時依據目標方向在來源節點的上、右、下、左四個邊界自動定位橘色 Catch 錨點（⚡），並主動錯開同側既有的 Transition 或 Compensation 連線；若同一對節點同時存在正常轉移（Transition）與例外捕獲（Catch），系統會自動保持 Transition 直線並將 Catch 朝外側平滑拱起分離。',
          '使用者亦可直接按住節點邊框上的橘色圓形錨點沿四邊自由拖曳，或在右側屬性面板指定錨點邊界與比例（ratio 0.1–0.9）；手動位置會持久化至 style.sourceAnchor（支援 JSON、YAML 註解保留與 SVG 匯出），雙擊錨點或執行自動排版即可恢復自動追蹤。對於跨越多欄的長跳躍連線（如前置檢核失敗直達 Succeed），繞道器會自動升級為泳道間隙內的圓角正交匯流排（10px 平行分道），確保線段絕不切穿任何無關節點。',
        ],
        table: {
          headers: ['操作方式', '行為說明', '序列化結果'],
          rows: [
            ['預設自動追蹤', '拖曳目標節點時，橘色 Catch 錨點自動沿四邊轉向並避讓同側其他連線。', '不寫入 sourceAnchor，保持純淨定義。'],
            ['拖曳橘色錨點', '沿來源節點上／右／下／左邊緣自由移動釘選位置，即時預覽繞線與標籤。', '於該條 Catch 物件寫入 style.sourceAnchor: { side, ratio }。'],
            ['屬性面板微調', '選取 Catch 連線後，在右側面板選擇自動或四邊方位與 10%–90% 位置滑桿。', '同步更新畫布、JSON/YAML 與 SVG 匯出。'],
            ['雙擊橘色錨點', '一鍵解除手動釘選，恢復 360° 智慧自動追蹤模式。', '移除 style.sourceAnchor 欄位。'],
          ],
        },
        codeBlock: {
          language: 'yaml',
          title: 'Catch 錨點手動釘選於 YAML 的儲存格式（關閉「包含畫布座標」時會自動省略）',
          code: `Catch:
  - Exceptions:
      - java.lang.Throwable
    Next: NotifyOpsIfNeeded
    style:
      sourceAnchor:
        side: right
        ratio: 0.72`,
        },
      },
      {
        id: 'minimax-ai-layout',
        heading: 'MiniMax AI 智慧語意排版（300 秒上限・可中途取消・耗時回報）',
        paragraphs: [
          '除了即時零延遲的本機自動排版，點擊工作列「AI 排版」可開啟 MiniMax 語意排版視窗。視窗內建 4 種語意策略（橫向主幹泳道、縱向泳道流程、補償配對優先、精簡簡報排版）、4 組常用提示詞快捷膠囊與 400 字自訂自然語言排版偏好，並可於 MiniMax-M3.1-Flash（快速推薦）、MiniMax-M3（深度推理）與 MiniMax-M2.5 之間自由切換。',
          '所有 AI 呼叫皆透過伺服器端 Next.js API Route（/api/saga/ai-layout）代理轉發，前端不接觸 API 金鑰。為因應大型深度推理模型回應時間，逾時上限已提升至 300 秒，執行期間畫面即時顯示 mm:ss 經過時間計時器並提供「取消」按鈕（透過 AbortController 即時中止前後端請求）；成功產生後會顯示總共耗時、前後對比 SVG 縮圖與量化品質指標（重疊節點數、連線交叉數、包圍尺寸與長寬比），並經本機碰撞消解與泳道對齊精修後一鍵套用（可隨時 Ctrl+Z 復原）。',
        ],
        figures: [
          {
            src: '/docs/images/09-ai-layout-modal.png',
            alt: 'AI 智慧語意排版彈窗顯示四種排版策略、自訂偏好、MiniMax 模型選單與即時畫布基準指標的截圖',
            caption:
              '圖 9-2：MiniMax AI 智慧語意排版視窗，提供 4 種排版策略、快捷提示詞、MiniMax 模型切換、目前畫布縮圖與量化品質基準，支援最高 300 秒逾時、即時取消與耗時統計。',
          },
        ],
        callout: {
          kind: 'info',
          title: '未設定 MINIMAX_API_KEY 或離線環境下的無縫備援',
          body: '若伺服器尚未設定 MINIMAX_API_KEY 或部署於純靜態 GitHub Pages 環境，AI 排版視窗會顯示清楚診斷訊息並提供「改用本機自動排版」一鍵備援按鈕，隨時享有同等五層泳道與無遮擋通道繞道品質。',
        },
      },
    ],
  },
];

const CHAPTERS_EN: DocChapter[] = [
  {
    index: '01',
    slug: '01-getting-started',
    category: 'Getting Started',
    title: 'Overview & Quick-Start Guide',
    summary:
      'Explore the Apache Seata Saga State Machine Designer workspace, official built-in templates, keyboard shortcuts, and a 3-step workflow to craft your first distributed transaction.',
    readTime: '4 min read',
    keywords: ['getting started', 'workspace', 'shortcuts', 'Seata Saga', 'templates', 'dark mode'],
    sections: [
      {
        id: 'workspace-anatomy',
        heading: 'Workspace Anatomy',
        paragraphs: [
          'Seata Saga State Machine Designer brings visual state graph editing, property inspection, bidirectional JSON/YAML editing, compensation simulation, and VS Code Web Extension packaging into one focused engineering workspace.',
          'On startup, the official Apache Seata reduceInventoryAndBalance example loads automatically so you can inspect forward tasks, Choice branching, Catch boundaries, and LIFO compensation immediately.',
        ],
        figures: [
          {
            src: '/docs/images/01-overview-canvas.png',
            alt: 'Full workspace overview of Seata Saga State Machine Designer',
            caption:
              'Figure 1-1: Complete workspace overview showing the top view switcher, utility toolbar, collapsible state palette, interactive canvas, and right property inspector.',
            annotations: [
              {
                label: 'Top Navigation Bar',
                detail:
                  'Switch cleanly between Designer, Split View, JSON / YAML, Simulator, and Docs, with a primary Export JSON action on the right.',
              },
              {
                label: 'Workspace Toolbar',
                detail:
                  'Switch templates, view machine metrics, trigger Undo/Redo, Auto Layout & style dropdown (Horizontal Swimlane / Compact / Vertical), MiniMax AI Layout, multi-file Import/Export YAML & SVG, Diagnostics, VS Code Extension packaging, Locale (ZH/EN), and Light/Dark theme.',
              },
              {
                label: 'Collapsible State Palette',
                detail:
                  'Contains 4 canvas interaction modes and all 8 official Seata state types with click-or-drag creation and an edge collapse handle.',
              },
              {
                label: 'Property Inspector',
                detail:
                  'Shows global state machine configuration when nothing is selected, or contextual state/edge editors upon selection.',
              },
            ],
          },
        ],
      },
      {
        id: 'three-step-quickstart',
        heading: 'Create Your First Saga in 3 Steps',
        paragraphs: [
          'Follow these three steps to build, validate, and export an Apache Seata Saga definition:',
        ],
        steps: [
          'Pick a template from the Workspace Toolbar (Inventory & Balance Deduction, Order Fulfillment + SubStateMachine, or Blank Starter).',
          'Drag ServiceTask, ScriptTask, Choice, or SubStateMachine states onto the canvas, connect ports for Next/Choice/Catch/CompensateState transitions, and configure fields in the right inspector.',
          'Click Validate to ensure 0 errors, test failure and rollback scenarios in Simulator, and export as comment-preserving YAML or JSON.',
        ],
      },
      {
        id: 'shortcuts-and-preferences',
        heading: 'Keyboard Shortcuts & Controls',
        paragraphs: [
          'All core canvas actions support standard desktop engineering shortcuts whenever no input field is focused:',
        ],
        table: {
          headers: ['Shortcut / Control', 'Action', 'Scope'],
          rows: [
            ['Ctrl + Z / Cmd + Z', 'Undo last edit (tracked independently per sub-state machine)', 'Canvas & Split View'],
            ['Ctrl + Y / Shift + Ctrl + Z', 'Redo undone edit', 'Canvas & Split View'],
            ['Alt + Left Arrow', 'Return from a drilled-down SubStateMachine to its parent machine', 'SubStateMachine View'],
            ['Escape', 'Cancel active connection mode or close open dialogs', 'Global'],
            ['Mouse Wheel / Drag Canvas', 'Zoom (15%–200%) and pan smoothly with Fit View (supports 27+ node production flows) & Reset controls', 'Canvas Viewport'],
          ],
        },
      },
    ],
  },
  {
    index: '02',
    slug: '02-canvas-and-states',
    category: 'Visual Design',
    title: 'Visual Canvas & Seata State Nodes',
    summary:
      'Master all 8 official Apache Seata Saga state types, 4 transition semantics, quick-append floating controls, and collapsible left/right edge handles.',
    readTime: '6 min read',
    keywords: ['ServiceTask', 'ScriptTask', 'Choice', 'SubStateMachine', 'CompensationTrigger', 'edge handles', 'auto layout'],
    sections: [
      {
        id: 'interactive-canvas',
        heading: 'Interactive Canvas, Quick Actions & Collapsible Side Panels',
        paragraphs: [
          'Selecting any node reveals a floating quick-action bar on its right edge so you can append ServiceTask, Choice, CompensationTask, or Succeed states in a single click.',
          'Use the edge collapse handles mounted on both the left state palette and right inspector/code panel to reclaim full horizontal viewport width when editing wide workflows.',
        ],
        figures: [
          {
            src: '/docs/images/02-canvas-node-selected.png',
            alt: 'Canvas with ReduceInventory selected showing floating quick-action bar and property inspector',
            caption:
              'Figure 2-1: Selecting ReduceInventory displays the quick-append bar, complete ServiceTask inspector, and left/right edge collapse handles.',
          },
        ],
      },
      {
        id: 'eight-state-types',
        heading: 'All 8 Official Seata Saga State Types',
        paragraphs: [
          'Every state type defined by Apache Seata STATE_LANG is natively modeled with dedicated styling and property forms:',
        ],
        table: {
          headers: ['State Type', 'Role', 'Key Properties'],
          rows: [
            ['StartState', 'Entry Point', 'Maps to top-level StartState reference; single start node per machine.'],
            ['ServiceTask', 'Microservice Call', 'ServiceType (SpringBean/Dubbo/SofaRPC), ServiceName, ServiceMethod, CompensateState, Input/Output, Status, Retry, Catch.'],
            ['ScriptTask', 'Inline Script', 'Executes Groovy or inline expressions (ScriptType, ScriptContent) for risk checks or transformations.'],
            ['Choice', 'Conditional Gateway', 'Evaluates ordered SpEL Choices[] expressions with an optional Default branch.'],
            ['SubStateMachine', 'Nested Sub-Workflow', 'Delegates execution via StateMachineName; double-click on canvas to drill down and edit.'],
            ['CompensationTrigger', 'Rollback Trigger', 'Triggers LIFO reverse compensation for all previously completed compensable tasks.'],
            ['Succeed', 'Success End', 'Marks normal transaction completion and commit.'],
            ['Fail', 'Failure End', 'Terminates the workflow with explicit ErrorCode and Message metadata.'],
          ],
        },
      },
      {
        id: 'four-edge-types',
        heading: '4 Transition Semantics, 360° Catch Anchors & Auto Layout',
        paragraphs: [
          'Solid slate arrows represent Next/Choice/Default transitions, dashed indigo arrows denote CompensateState bindings, and dotted amber arrows indicate Catch exception boundaries.',
          'Every Catch edge uses 360° dynamic perimeter tracking: its amber anchor marker automatically snaps to the top, right, bottom, or left border facing the target while avoiding sibling Transition and Compensation wires. You can also drag the amber handle anywhere along the 4 borders to pin a custom style.sourceAnchor, or double-click the handle to restore automatic tracking.',
          'Click Auto Layout (or open its split-button dropdown to switch between Horizontal Swimlane, Compact Presentation, and Vertical Top-Down) to run our 5-band semantic swimlane engine with obstacle-free rounded corridor routing (see Chapter 09).',
        ],
        callout: {
          kind: 'tip',
          title: 'One-Click Compensation Scaffolding',
          body: 'Select any ServiceTask and click the indigo Undo arrow in the floating quick-action bar to automatically create an IsForCompensation partner task positioned directly underneath and wired via CompensateState.',
        },
      },
    ],
  },
  {
    index: '03',
    slug: '03-split-view-sync',
    category: 'Split Synchronization',
    title: 'Split View Sync & Line Flash Highlight',
    summary:
      'Work side-by-side across the visual canvas and JSON/YAML editor with instant jump-to-location scrolling and luminous block flash highlights.',
    readTime: '4 min read',
    keywords: ['split view', 'line highlight', 'flash', 'source locator', 'JSON', 'YAML'],
    sections: [
      {
        id: 'click-to-flash',
        heading: 'Click-to-Locate & Block Flash Effect',
        paragraphs: [
          'Switch to Split View in the top navigation bar to pair the canvas with a line-numbered JSON/YAML source editor.',
          'Clicking any node or transition edge invokes the deterministic Source Locator, smoothly scrolls the exact block into view within 240ms, displays the line span badge (e.g. ReduceBalance · L59-88), and flashes the matched source lines.',
        ],
        figures: [
          {
            src: '/docs/images/03-split-view-flash.png',
            alt: 'Split View mode highlighting ReduceBalance at lines 59-88 in YAML',
            caption:
              'Figure 3-1: Clicking ReduceBalance in Split View scrolls directly to lines L59-88 in YAML and flashes the highlighted block.',
          },
        ],
      },
      {
        id: 'bidirectional-editing',
        heading: 'Bidirectional Sync & Layout Bounds Toggle',
        paragraphs: [
          'Visual edits immediately regenerate the source pane. Direct edits in the JSON/YAML editor enable Apply to Canvas for instant re-parsing and canvas synchronization.',
          'Toggle Include layout bounds (style) whenever you want to omit visual coordinates for minimal production payloads.',
        ],
        callout: {
          kind: 'info',
          title: 'Edge-Level Precision',
          body: 'Clicking Choice labels, purple CompensateState arrows, or amber Catch arrows jumps straight to the matching Choices, CompensateState, or Catch lines inside the source state block.',
        },
      },
    ],
  },
  {
    index: '04',
    slug: '04-yaml-comments',
    category: 'YAML Engineering',
    title: 'YAML Import/Export & # Comment Preservation',
    summary:
      'Understand how the YAML v2 AST reconciliation pipeline preserves header, block, inline, array, and trailing # comments across visual canvas edits.',
    readTime: '5 min read',
    keywords: ['YAML', 'comments', 'AST', 'import', 'export', 'format'],
    sections: [
      {
        id: 'comment-preservation-demo',
        heading: 'Lossless # Comment Preservation',
        paragraphs: [
          'Production Seata Saga YAML files often carry essential business annotations and operational comments. Naive JSON-to-YAML re-serialization destroys every # comment.',
          'Our YAML v2 Document AST reconciler preserves header comments, block comments, inline comments, sequence item comments, and trailing comments across node drags, Catch anchor edits (style.sourceAnchor), property changes, and state renames. Multi-document YAML files separated by --- are also supported during batch import with per-document comment preservation.',
        ],
        figures: [
          {
            src: '/docs/images/04-yaml-comments-editor.png',
            alt: 'YAML editor preserving header, inline, and block # comments',
            caption:
              'Figure 4-1: Commented Seata YAML synced to the visual canvas while retaining header, StartState inline, and ReduceInventory block comments intact.',
          },
        ],
      },
      {
        id: 'ast-pipeline-diagram',
        heading: 'YAML AST Reconciliation Pipeline',
        paragraphs: [
          'When YAML is imported or applied, the original text is retained alongside the SagaGraph as yamlTemplate. Subsequent exports reconcile updated values and renamed state keys in place inside the YAML Document AST so original comments stay anchored.',
        ],
        diagram: {
          id: 'yaml-ast-pipeline',
          title: 'YAML v2 AST Comment-Preserving Pipeline',
          caption:
            'Diagram 4-1: Original YAML feeds both the visual graph and AST template; edits reconcile in place to emit comment-safe .saga.yaml.',
        },
      },
      {
        id: 'yaml-example',
        heading: 'Commented Seata Saga YAML Example',
        paragraphs: [
          'Paste this commented YAML into the JSON / YAML view or import it as a .saga.yaml file to test lossless preservation:',
        ],
        codeBlock: {
          language: 'yaml',
          title: 'orderInventory.saga.yaml',
          code: `# Apache Seata Saga inventory & balance workflow
# All forward ServiceTasks must register a CompensateState
Name: reduceInventoryAndBalance
Comment: Reduce inventory then reduce balance
StartState: ReduceInventory # Workflow entry point
Version: 1.0.0
Type: STATE_LANG
Persist: true
States:
  # Step 1: Deduct inventory (compensated on downstream failure)
  ReduceInventory:
    Type: ServiceTask
    ServiceName: inventoryAction
    ServiceMethod: reduce
    ServiceType: SpringBean
    CompensateState: CompensateReduceInventory # Linked rollback task
    Input:
      - $. [businessKey] # Business order key
      - $. [count]       # Requested SKU count
    Next: Succeed`,
        },
      },
    ],
  },
  {
    index: '05',
    slug: '05-sub-state-machine',
    category: 'Nested Workflows',
    title: 'Multi-Level SubStateMachine Drill-Down',
    summary:
      'Navigate 3-level nested workflows (Order Fulfillment -> Payment Settlement -> Fraud Verification) via double-click drill-down, parent return breadcrumbs, cycle blocking, and isolated undo stacks.',
    readTime: '6 min read',
    keywords: ['SubStateMachine', 'nested', 'drill-down', 'breadcrumb', 'cycle protection'],
    sections: [
      {
        id: 'parent-drilldown',
        heading: 'Double-Click to Enter Any SubStateMachine',
        paragraphs: [
          'Switch the template dropdown to Order Fulfillment + SubStateMachine to inspect a realistic 3-level hierarchy. Double-click the sky-blue PaymentSubMachine node (or click Open SubStateMachine in the right inspector) to drill straight into paymentSettlementSubSaga.',
        ],
        figures: [
          {
            src: '/docs/images/05-submachine-parent.png',
            alt: 'Parent orderFulfillmentSaga with PaymentSubMachine selected',
            caption:
              'Figure 5-1: Selecting PaymentSubMachine in the root machine shows linked workspace status (9 states) and one-click drill-down.',
          },
        ],
      },
      {
        id: 'breadcrumb-return',
        heading: 'Hierarchical Breadcrumb & Instant Parent Return',
        paragraphs: [
          'Inside any nested state machine, the navigation breadcrumb bar displays your full call path and current depth. Click Back to Parent, click any ancestor crumb, or press Alt + Left Arrow to return to the parent machine with the originating SubStateMachine node automatically re-selected.',
        ],
        figures: [
          {
            src: '/docs/images/05-submachine-level2.png',
            alt: 'Drilled-down Level-2 paymentSettlementSubSaga with breadcrumb and Level-3 FraudSubCheck',
            caption:
              'Figure 5-2: Level-2 paymentSettlementSubSaga with Back to Parent breadcrumb and Level-3 FraudSubCheck ready for further drill-down.',
          },
        ],
      },
      {
        id: 'submachine-architecture',
        heading: 'Call Stack Architecture & Safety Guards',
        paragraphs: [
          'The workspace state engine enforces four production safety mechanisms across arbitrary nesting depths:',
        ],
        diagram: {
          id: 'submachine-stack',
          title: '3-Level SubStateMachine Call Stack & Guards',
          caption:
            'Diagram 5-1: Root-to-Level-3 navigation stack with auto-scaffolding, cycle protection, and isolated per-machine Undo/Redo history.',
        },
        steps: [
          'Auto-Scaffolding: Double-clicking a SubStateMachine referencing a new name automatically creates a starter workflow with StartState, ServiceTask, CompensationTask, and Succeed.',
          'Cycle Protection: Direct self-calls and multi-hop circular references are detected and blocked cleanly.',
          'Isolated Per-Machine History: Ctrl+Z inside a child workflow only reverts edits in that child machine.',
          'Automatic Rename Sync: Updating a child machine Name keeps its parent SubStateMachine StateMachineName reference synchronized.',
        ],
      },
      {
        id: 'batch-import-parent-child',
        heading: 'Multi-File Parent-Child Batch Import & Production Example',
        paragraphs: [
          'Click Import JSON/YAML to select up to 30 files at once (.yaml, .yml, .json, multi-document YAML ---, or JSON arrays). Regardless of file selection order, the batch importer analyzes SubStateMachine references to identify the root state machine, links all child machines automatically, displays the sky-blue Imported Bundle switcher bar (Root / Sub / Flow), and reports any missing references, duplicate names, or partial syntax errors.',
          'Try importing all 3 real-world YAML files under examples/omni-cash-transaction/ (omni_cash_transaction.saga.yaml, repayment_cash_deposit.saga.yaml, and repayment_cash_cancellation.saga.yaml) together to experience automatic parent-child linking, drill-down navigation, and large-graph swimlane auto-layout.',
        ],
        figures: [
          {
            src: '/docs/images/09-auto-layout-omni-menu.png',
            alt: 'Batch-imported 3-file omni-cash-transaction bundle with Root/Sub switcher bar and Auto-Layout style menu open',
            caption:
              'Figure 5-3: Importing all 3 omni-cash-transaction YAML files together links omni_cash_transaction as root with both child sub-machines ready for instant switching or double-click drill-down.',
          },
        ],
      },
    ],
  },
  {
    index: '06',
    slug: '06-validation-and-simulation',
    category: 'Validation & Simulation',
    title: 'Topology Validation & Compensation Simulator',
    summary:
      'Verify Seata STATE_LANG compliance in real time and dry-run forward execution, exception Catch transitions, and LIFO compensation rollbacks before deployment.',
    readTime: '5 min read',
    keywords: ['validator', 'simulator', 'LIFO', 'compensation', 'Catch', 'step-by-step'],
    sections: [
      {
        id: 'lifo-simulation',
        heading: 'Interactive Dry-Run & LIFO Rollback Simulation',
        paragraphs: [
          'Open Simulator from the top bar, edit the initial JSON context, and override task outcomes to SU, FA, or Throw Exception. Running a failure on ReduceBalance walks through Catch -> CompensationTrigger -> CompensateReduceInventory -> Fail while coloring every active node and edge live on the canvas.',
        ],
        figures: [
          {
            src: '/docs/images/06-simulation-compensation.png',
            alt: 'Saga Simulator executing a ReduceBalance exception and LIFO compensation rollback',
            caption:
              'Figure 6-1: Forcing Throw Exception on ReduceBalance traces Catch routing and LIFO compensation live on both the canvas and step trace panel.',
          },
        ],
      },
      {
        id: 'saga-lifecycle-diagram',
        heading: 'Forward Execution vs. LIFO Compensation Flow',
        paragraphs: [
          'Use Step Next to inspect context mutations one state at a time. Nested SubStateMachine nodes are recursively simulated as part of the full trace.',
        ],
        diagram: {
          id: 'saga-lifecycle',
          title: 'Seata Saga Forward Execution & LIFO Rollback Lifecycle',
          caption:
            'Diagram 6-1: Completed compensable tasks push onto the rollback stack and execute in reverse LIFO order when CompensationTrigger fires.',
        },
      },
      {
        id: 'validation-drawer',
        heading: 'Real-Time Diagnostics Drawer',
        paragraphs: [
          'Click Validate in the toolbar to inspect structural diagnostics. Clicking any error or warning immediately selects and focuses the offending node or edge on the canvas.',
        ],
        figures: [
          {
            src: '/docs/images/06-validation-drawer.png',
            alt: 'Validation drawer showing zero errors and zero warnings',
            caption:
              'Figure 6-2: Real-time validation drawer confirming full Apache Seata STATE_LANG compliance.',
          },
        ],
        table: {
          headers: ['Diagnostic Code', 'Severity', 'Rule Description'],
          rows: [
            ['NO_START_STATE', 'Error', 'Missing StartState node or missing outgoing transition from StartState.'],
            ['MISSING_SERVICE_META', 'Error', 'ServiceTask is missing required ServiceName or ServiceMethod.'],
            ['EMPTY_SCRIPT', 'Error', 'ScriptTask is missing executable ScriptContent.'],
            ['SUBMACHINE_SELF_CYCLE', 'Error', 'SubStateMachine references its own enclosing state machine name.'],
            ['UNRESOLVED_SUBMACHINE', 'Warning', 'Referenced sub-state machine does not yet exist in the workspace registry.'],
            ['UNREACHABLE_STATE', 'Warning', 'Non-compensation state cannot be reached from StartState.'],
          ],
        },
      },
    ],
  },
  {
    index: '07',
    slug: '07-vscode-extension',
    category: 'IDE Integration',
    title: 'VS Code Web & Desktop Extension Guide',
    summary:
      'Download a zero-build, zero-Node-dependency Universal VS Code Extension that runs natively in vscode.dev, github.dev, GitHub Codespaces, and VS Code Desktop.',
    readTime: '6 min read',
    keywords: ['VS Code', 'vscode.dev', 'github.dev', 'Web Extension', 'CustomTextEditorProvider', 'Webview Bridge'],
    sections: [
      {
        id: 'download-and-install',
        heading: 'One-Click Download & Zero-Build Installation',
        paragraphs: [
          'Click VS Code Ext in the workspace toolbar to configure your Hosted Designer URL and download a ready-to-run Universal Web Extension archive (seata-saga-vscode-web-extension.zip).',
          'Because the bundle declares "browser": "./dist/web/extension.js" and relies strictly on vscode.workspace.fs and Webview APIs with zero Node.js built-ins, it runs inside browser Web Workers on vscode.dev and github.dev as well as desktop VS Code.',
        ],
        figures: [
          {
            src: '/docs/images/07-vscode-modal-install.png',
            alt: 'VS Code Web & Desktop Extension modal showing download button and CLI commands',
            caption:
              'Figure 7-1: Configure the designer URL, download the ready-to-run .zip archive, or copy commands for @vscode/test-web, vscode.dev, and .vsix packaging.',
          },
        ],
        codeBlock: {
          language: 'bash',
          title: 'Launch & Packaging Commands',
          code: `# 1. Launch directly in browser-based VS Code (zero build required)
npx @vscode/test-web --browserType=chromium --extensionDevelopmentPath=./seata-saga-vscode-web

# 2. Sideload into vscode.dev / github.dev (then run F1 -> Developer: Install Web Extension)
npx serve --cors ./seata-saga-vscode-web

# 3. Package as .vsix for Desktop VS Code or Visual Studio Marketplace
cd seata-saga-vscode-web && npx @vscode/vsce package --target web && code --install-extension seata-saga-designer-1.0.0.vsix`,
        },
      },
      {
        id: 'live-webview-bridge',
        heading: 'Interactive Live Webview Bridge Sandbox',
        paragraphs: [
          'Switch to the Live Webview Bridge tab inside the modal to test the real ?embed=vscode postMessage protocol right in your browser. Click any node inside the embedded designer to observe live Reveal Source line synchronization, Problems panel diagnostics, theme mirroring, and workspace sub-machine drill-down.',
        ],
        figures: [
          {
            src: '/docs/images/07-vscode-live-bridge.png',
            alt: 'Live VS Code Webview Bridge simulator showing orderFulfillment.saga.yaml and Reveal PaymentSubMachine (L78-98)',
            caption:
              'Figure 7-2: Live Webview Bridge sandbox proving real bidirectional postMessage sync, dark theme mirroring, narrow-pane auto-collapse, and Reveal Source line tracking.',
          },
        ],
      },
      {
        id: 'vscode-bridge-diagram',
        heading: 'Dual-Runtime Host Bridge Architecture & Settings',
        paragraphs: [
          'The Webview enforces strict Content-Security-Policy rules (allowing only https:// or http://localhost origins) and origin-checked postMessage relaying, integrating seamlessly with VS Code native save, undo, Git Diff, Problems diagnostics, and multi-file sub-machine scanning.',
        ],
        diagram: {
          id: 'vscode-bridge',
          title: 'VS Code Web & Desktop Dual-Runtime Bridge Architecture',
          caption:
            'Diagram 7-1: CustomTextEditorProvider and CSP-verified Webview relay synchronize documents, workspace sub-machines, diagnostics, and source line highlights.',
        },
        table: {
          headers: ['VS Code Setting', 'Default', 'Description'],
          rows: [
            ['seataSaga.designerUrl', 'Current app origin', 'Hosted designer URL loaded inside the Webview (https or localhost only).'],
            ['seataSaga.defaultFormat', 'yaml', 'Default file format for newly scaffolded root and sub-state machines (yaml or json).'],
            ['seataSaga.syncDiagnostics', 'true', 'Publish topology errors and warnings directly into the VS Code Problems panel.'],
            ['seataSaga.autoScanSubMachines', 'true', 'Scan workspace *.saga.* files automatically for cross-file SubStateMachine drill-down.'],
          ],
        },
      },
    ],
  },
  {
    index: '08',
    slug: '08-schema-and-faq',
    category: 'Reference',
    title: 'Seata STATE_LANG Schema Reference & FAQ',
    summary:
      'Complete Apache Seata Saga STATE_LANG field reference, Input/Output & Choice expression cheat sheet, and troubleshooting FAQ.',
    readTime: '5 min read',
    keywords: ['STATE_LANG', 'schema', 'JSONPath', 'SpEL', 'Retry', 'Status', 'FAQ'],
    sections: [
      {
        id: 'top-level-schema',
        heading: 'Core State Machine & Task Fields',
        paragraphs: [
          'Reference table of Apache Seata STATE_LANG fields supported bidirectionally across both JSON and YAML:',
        ],
        table: {
          headers: ['Field', 'Scope', 'Type', 'Description'],
          rows: [
            ['Name', 'Root', 'string', 'Unique identifier for the state machine and target key for SubStateMachine calls.'],
            ['StartState', 'Root', 'string', 'Name of the initial state executed when the machine starts.'],
            ['Version', 'Root', 'string', 'Semantic version string (e.g. 0.0.1 or 1.2.0).'],
            ['Type', 'Root', 'string', 'Fixed value STATE_LANG per Apache Seata specification.'],
            ['Persist', 'Root', 'boolean', 'Persists state execution and compensation logs to the Seata store.'],
            ['ServiceName / ServiceMethod', 'ServiceTask', 'string', 'Target SpringBean, Dubbo, or SofaRPC bean and method name.'],
            ['CompensateState', 'Task / SubMachine', 'string', 'Partner compensation state name (target must have IsForCompensation: true).'],
            ['Input / Output', 'Task / SubMachine', 'array / object', 'Context extraction ($.[key]) and return value mapping ($.#root).'],
            ['Status', 'ServiceTask', 'object', 'Expression mapping to classify execution outcome as SU, FA, or UN.'],
            ['Catch / Retry', 'Task / SubMachine', 'array', 'Exception catch routing (Next) and exponential backoff retry policies.'],
            ['style.bounds / style.sourceAnchor', 'Designer Layout Meta', 'object', 'Stores node geometry (x, y, width, height) and manually pinned Catch anchors (side, ratio); stripped cleanly when Include Layout (style) is disabled.'],
          ],
        },
      },
      {
        id: 'env-and-deployment',
        heading: 'Server Environment Variables & Deployment (.env.example)',
        paragraphs: [
          'Configure these server-side environment variables when enabling MiniMax AI Layout or building static GitHub Pages exports (API keys remain strictly server-side and are never exposed to the browser):',
        ],
        table: {
          headers: ['Environment Variable', 'Purpose', 'Default / Notes'],
          rows: [
            ['MINIMAX_API_KEY', 'MiniMax AI Layout API key', 'Optional; enables /api/saga/ai-layout (local Auto Layout works with zero keys).'],
            ['MINIMAX_BASE_URL', 'MiniMax API endpoint', 'Defaults to https://api.minimax.io/v1 (restricted to allowlisted HTTPS hosts).'],
            ['MINIMAX_MODEL', 'Default AI Layout model', 'Defaults to MiniMax-M3.1-Flash; also supports MiniMax-M3 and MiniMax-M2.5.'],
            ['BUILD_TARGET', 'Static export switch', 'Set to github-pages to enable Next.js static export (output: export).'],
            ['GITHUB_PAGES_BASE_PATH', 'Subpath base prefix', 'Optional prefix (e.g. /seata-saga-designer) applied to static routes and images.'],
          ],
        },
      },
      {
        id: 'expression-cheatsheet',
        heading: 'Input / Output & Choice Expression Cheat Sheet',
        paragraphs: [
          'Common expression syntax supported by Apache Seata Saga and our built-in simulator:',
        ],
        codeBlock: {
          language: 'yaml',
          title: 'Common Expressions',
          code: `# Input: extract context variables into service arguments
Input:
  - "$.[businessKey]"
  - "$.[amount]"

# Output: write service return value (#root) back into workflow context
Output:
  reduceInventoryResult: "$.#root"

# Choice Expression: evaluate boolean or numeric comparisons
Choices:
  - Expression: "[reduceInventoryResult] == true"
    Next: ReduceBalance
  - Expression: "[riskScore] < 80"
    Next: PaymentSubMachine
Default: Fail`,
        },
      },
      {
        id: 'faq',
        heading: 'Frequently Asked Questions',
        paragraphs: [
          'Solutions to the most common questions during workflow modeling, Auto/AI Layout, YAML comment preservation, and VS Code Web deployment:',
        ],
        table: {
          headers: ['Question', 'Solution'],
          rows: [
            [
              'Imported legacy JSON/YAML lacks style.bounds coordinates or large flows look clipped.',
              'Coordinate-free files are automatically arranged by the 5-band semantic swimlane layout engine. Use the Auto Layout split menu (Compact Presentation / Vertical Top-Down) and Fit View (down to 15% zoom) to inspect 27+ node workflows completely.',
            ],
            [
              'How can I move a Catch edge exit point around its source node or restore auto-tracking?',
              'Drag the amber circular Catch marker along any of the 4 borders of its source node (or pick a side & ratio in the right inspector). Double-click the marker or run Auto Layout to return to 360° automatic tracking.',
            ],
            [
              'AI Layout reports missing MINIMAX_API_KEY or takes long on complex graphs.',
              'Configure MINIMAX_API_KEY in server environment variables or Settings > Secrets. Requests support up to a 300s timeout ceiling with live elapsed timer and Cancel button, or you can use one-click local Auto Layout anytime.',
            ],
            [
              'How can I verify that YAML # comments are preserved after visual edits?',
              'Keep the source imported/applied as YAML and inspect it in Split View (YAML tab) — header, block, inline, and trailing # comments remain intact.',
            ],
            [
              'Why did double-clicking a SubStateMachine display a cycle warning?',
              'The node StateMachineName points directly or indirectly to an active ancestor machine. Update StateMachineName to break the recursion cycle.',
            ],
            [
              'Why does the Webview fail to load inside vscode.dev?',
              'Verify seataSaga.designerUrl uses an HTTPS origin (or http://localhost:3000 locally) and allows iframe embedding.',
            ],
          ],
        },
      },
    ],
  },
  {
    index: '09',
    slug: '09-auto-layout-and-ai',
    category: 'Layout & Routing Engine',
    title: 'Saga-Aware Auto-Layout, 360° Catch Anchors & AI Layout',
    summary:
      'Deep dive into our 5-band semantic swimlane Auto-Layout engine, 360° draggable Catch boundary anchors, obstacle-free rounded corridor routing, and MiniMax AI semantic layout.',
    readTime: '6 min read',
    keywords: [
      'auto layout',
      'swimlane',
      'Catch anchor',
      'sourceAnchor',
      'corridor routing',
      'AI layout',
      'MiniMax',
      '300s timeout',
      'cancel',
    ],
    sections: [
      {
        id: 'semantic-swimlane-layout',
        heading: '5-Band Semantic Swimlane Auto-Layout & 3 Built-In Modes',
        paragraphs: [
          'In real-world enterprise Saga workflows (such as the 27-node, 44-edge repayment_cash_cancellation.saga.yaml), naive BFS shortest-path layering strands shared Succeed terminals in the middle of the graph, creating backward-flying arrows and tangled wires slicing through nodes.',
          'Our Saga-aware layout engine (lib/saga/autoLayout.ts) combines cycle-safe Kahn longest-path layering with 5 semantic swimlane bands: Band 0 locks the main happy-path spine onto an exact 0px centerline, Band -1 elevates timeout/reconciliation/query/diagnostics tracks above the spine, Band +1 aligns paired CompensateState tasks plumb beneath their forward tasks alongside direct rejections, Band +2 organizes CompensationTrigger rollback chains, and Band +3 isolates rollback-failure alerting and Fail terminals. Succeed always sits strictly at the far end, guaranteeing 0 node overlaps, 0 backward edges, 0 routed node hits, and 0 label collisions.',
          'Clicking Auto Layout applies your active style instantly and fits the viewport (down to 15% zoom for large flows). Open the adjacent chevron menu to switch among Horizontal Swimlane (Default), Compact Presentation (tighter column gaps for wide production flows), and Vertical Top-Down (dynamic caption-aware row heights).',
        ],
        figures: [
          {
            src: '/docs/images/09-auto-layout-large-cancellation.png',
            alt: '27-node 44-edge repayment_cash_cancellation workflow arranged cleanly by the 5-band semantic swimlane auto-layout engine',
            caption:
              'Figure 9-1: The 27-node, 44-edge repayment_cash_cancellation production flow laid out across 5 semantic swimlanes with staggered rounded corridor buses, fitting cleanly at 21% zoom with 0 overlaps and 0 routed node hits.',
          },
        ],
        diagram: {
          id: 'layout-routing-pipeline',
          title: '4-Stage Auto-Layout & Obstacle-Free Routing Pipeline',
          caption:
            'Diagram 9-1: End-to-end pipeline from semantic swimlane classification and DAG layering through 360° Catch anchoring, corridor bus routing, and collision-free label placement.',
        },
      },
      {
        id: 'catch-anchor-and-corridors',
        heading: '360° Dynamic Catch Boundary Anchors & Rounded Corridor Routing',
        paragraphs: [
          'Catch edges dynamically track their target across all 4 borders (top, right, bottom, left) of the source node while automatically avoiding sibling Transition and Compensation wires. When a Transition and Catch share the exact same (source, target) pair, the Transition stays crisp and straight while the Catch arcs smoothly outward.',
          'Drag any amber circular Catch handle along its source node perimeter (or fine-tune side and 10%–90% ratio in the Properties Panel) to pin a custom style.sourceAnchor persisted across JSON, comment-preserving YAML, and SVG export. Double-click the handle or run Auto Layout to reset to 360° auto-tracking. Long skip edges automatically upgrade to 10px-staggered rounded orthogonal corridor buses running through open horizontal gutters between swimlanes, achieving 0 edge-through-node hits.',
        ],
        table: {
          headers: ['Interaction', 'Behavior', 'Persistence'],
          rows: [
            ['Auto 360° Tracking', 'Amber Catch marker smoothly follows target direction across all 4 borders and avoids sibling wires.', 'Omits sourceAnchor for clean default output.'],
            ['Drag Amber Marker', 'Pin exit position anywhere along top/right/bottom/left perimeter with live wire and label preview.', 'Writes style.sourceAnchor: { side, ratio } on that Catch entry.'],
            ['Inspector Controls', 'Select a Catch edge to choose Auto or a fixed border side plus 10%–90% ratio slider.', 'Synced across canvas, JSON/YAML, and SVG export.'],
            ['Double-Click Marker', 'Unpins custom anchor immediately and restores 360° automatic tracking.', 'Removes style.sourceAnchor cleanly.'],
          ],
        },
        codeBlock: {
          language: 'yaml',
          title: 'Pinned Catch sourceAnchor in YAML (omitted automatically when Include Layout is unchecked)',
          code: `Catch:
  - Exceptions:
      - java.lang.Throwable
    Next: NotifyOpsIfNeeded
    style:
      sourceAnchor:
        side: right
        ratio: 0.72`,
        },
      },
      {
        id: 'minimax-ai-layout',
        heading: 'MiniMax AI Semantic Layout (300s Ceiling, Cancellation & Duration)',
        paragraphs: [
          'Alongside instant deterministic Auto Layout, click AI Layout in the toolbar to open the MiniMax semantic layout modal. Choose from 4 layout strategies (Horizontal Swimlane, Vertical Flowchart, Compensation Aligned, Compact Executive), quick prompt presets, custom natural-language preferences (up to 400 characters), and 3 MiniMax models: MiniMax-M3.1-Flash (recommended fast default), MiniMax-M3 (flagship reasoning), and MiniMax-M2.5.',
          'All requests proxy securely through the server-side Next.js route (/api/saga/ai-layout) without exposing MINIMAX_API_KEY to the browser. Requests support up to a 300-second timeout ceiling, display a live mm:ss elapsed timer, and provide a Cancel button backed by AbortController to abort in-flight work cleanly. Completed runs report total elapsed duration, render before/after SVG previews and quality metrics (overlaps, crossings, aspect ratio), pass through deterministic collision resolution and swimlane alignment, and apply undoably via Ctrl+Z.',
        ],
        figures: [
          {
            src: '/docs/images/09-ai-layout-modal.png',
            alt: 'MiniMax AI Semantic Layout modal showing 4 strategy cards, custom prompt presets, model selector, and live graph preview',
            caption:
              'Figure 9-2: MiniMax AI Semantic Layout modal with 4 layout strategies, model selector, live mini-preview, baseline quality metrics, 300s timeout ceiling, and cancellation support.',
          },
        ],
        callout: {
          kind: 'info',
          title: 'Zero-Key & Static Hosting Fallback',
          body: 'When MINIMAX_API_KEY is not configured or the app runs as a static GitHub Pages build, the modal shows clear diagnostics and a one-click Local Auto Layout fallback delivering the same 5-band swimlane and corridor routing quality.',
        },
      },
    ],
  },
];

export function getDocsChapters(locale: Locale): DocChapter[] {
  return locale === 'zh-TW' ? CHAPTERS_ZH : CHAPTERS_EN;
}

export function getDocsChapterBySlug(
  slug: string,
  locale: Locale
): DocChapter | undefined {
  return getDocsChapters(locale).find((ch) => ch.slug === slug);
}

export function searchDocsChapters(
  query: string,
  locale: Locale
): DocChapter[] {
  const chapters = getDocsChapters(locale);
  const clean = query.trim().toLowerCase();
  if (!clean) return chapters;

  return chapters.filter((ch) => {
    const haystack = [
      ch.index,
      ch.category,
      ch.title,
      ch.summary,
      ...ch.keywords,
      ...ch.sections.flatMap((sec) => [
        sec.heading,
        ...sec.paragraphs,
        ...(sec.steps ?? []),
        sec.callout?.title ?? '',
        sec.callout?.body ?? '',
        ...(sec.table?.rows.flat() ?? []),
      ]),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(clean);
  });
}

export function renderChapterToMarkdown(
  chapter: DocChapter,
  options?: { imageBasePath?: string }
): string {
  const imageBase = options?.imageBasePath ?? '../public/docs/images';
  const lines: string[] = [];

  lines.push(`# ${chapter.index}. ${chapter.title}`);
  lines.push('');
  lines.push(`> ${chapter.summary}`);
  lines.push('');
  lines.push(`**分類**：${chapter.category} · **閱讀時間**：${chapter.readTime}`);
  lines.push('');

  for (const sec of chapter.sections) {
    lines.push(`## ${sec.heading}`);
    lines.push('');

    for (const p of sec.paragraphs) {
      lines.push(p);
      lines.push('');
    }

    if (sec.steps && sec.steps.length > 0) {
      sec.steps.forEach((step, idx) => {
        lines.push(`${idx + 1}. ${step}`);
      });
      lines.push('');
    }

    if (sec.figures && sec.figures.length > 0) {
      for (const fig of sec.figures) {
        const fileName = fig.src.split('/').pop() ?? fig.src;
        lines.push(`![${fig.alt}](${imageBase}/${fileName})`);
        lines.push('');
        lines.push(`*${fig.caption}*`);
        lines.push('');
        if (fig.annotations && fig.annotations.length > 0) {
          for (const ann of fig.annotations) {
            lines.push(`- **${ann.label}**：${ann.detail}`);
          }
          lines.push('');
        }
      }
    }

    if (sec.diagram) {
      lines.push(`### ${sec.diagram.title}`);
      lines.push('');
      lines.push(`*${sec.diagram.caption}*`);
      lines.push('');
    }

    if (sec.table) {
      lines.push(`| ${sec.table.headers.join(' | ')} |`);
      lines.push(`| ${sec.table.headers.map(() => '---').join(' | ')} |`);
      for (const row of sec.table.rows) {
        lines.push(
          `| ${row.map((cell) => cell.replace(/\|/g, '\\|')).join(' | ')} |`
        );
      }
      lines.push('');
    }

    if (sec.codeBlock) {
      if (sec.codeBlock.title) {
        lines.push(`**${sec.codeBlock.title}**`);
        lines.push('');
      }
      lines.push(`\`\`\`${sec.codeBlock.language}`);
      lines.push(sec.codeBlock.code);
      lines.push('```');
      lines.push('');
    }

    if (sec.callout) {
      lines.push(`> **${sec.callout.title}**`);
      lines.push(`> ${sec.callout.body}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function buildDocsMarkdownFiles(
  locale: Locale,
  options?: { imageBasePath?: string }
): ZipEntryInput[] {
  const chapters = getDocsChapters(locale);
  const imageBase = options?.imageBasePath ?? '../public/docs/images';

  const readmeLines: string[] = [
    locale === 'zh-TW'
      ? '# Apache Seata Saga State Machine Designer 完整使用與架構說明文件'
      : '# Apache Seata Saga State Machine Designer — Complete Illustrated Documentation',
    '',
    locale === 'zh-TW'
      ? '本系列文件涵蓋視覺化設計器、360° 動態 Catch 錨點、五層語意自動排版、MiniMax AI 排版、雙欄行號閃爍同步、YAML `#` 註解保留、多檔父子匯入、多層 `SubStateMachine` 巢狀鑽取、分散式事務補償模擬與 VS Code 瀏覽器／桌面版擴充套件的完整圖文操作指南。'
      : 'Complete illustrated documentation covering visual workflow modeling, 360° dynamic Catch anchors, 5-band semantic Auto-Layout, MiniMax AI Layout, Split View flash sync, YAML # comment preservation, multi-file parent-child batch import, multi-level SubStateMachine drill-down, LIFO compensation simulation, and the Universal VS Code Web & Desktop Extension.',
    '',
    locale === 'zh-TW' ? '## GitHub Pages 部署' : '## GitHub Pages Deployment',
    '',
    locale === 'zh-TW'
      ? '部署前，請由儲存庫管理員在 **Settings → Pages → Build and deployment → Source** 選擇 **GitHub Actions**。之後推送至 `main` 或手動執行 **Deploy to GitHub Pages** workflow；若先前執行失敗，請重新執行。靜態建置可在未啟用 Pages 時完成，但部署仍需要此設定。'
      : 'Before deploying, a repository administrator must select **GitHub Actions** under **Settings → Pages → Build and deployment → Source**, then push to `main` or manually trigger the **Deploy to GitHub Pages** workflow.',
    '',
    locale === 'zh-TW' ? '## 文件目錄' : '## Table of Contents',
    '',
    ...chapters.map(
      (ch) =>
        `- [${ch.index}. ${ch.title}](./${ch.slug}.md) — ${ch.summary}`
    ),
    '',
  ];

  const entries: ZipEntryInput[] = [
    {
      path: 'README.md',
      content: readmeLines.join('\n'),
    },
  ];

  for (const ch of chapters) {
    entries.push({
      path: `${ch.slug}.md`,
      content: renderChapterToMarkdown(ch, { imageBasePath: imageBase }),
    });
  }

  return entries;
}

export function buildDocsZipArchive(locale: Locale): Uint8Array {
  const mdFiles = buildDocsMarkdownFiles(locale, {
    imageBasePath: './images',
  });
  const prefixed: ZipEntryInput[] = mdFiles.map((entry) => ({
    path: `seata-saga-designer-docs/${entry.path}`,
    content: entry.content,
  }));
  return buildZipArchive(prefixed);
}
