import fs from "node:fs";
import path from "node:path";
import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  ImportedXmlComponent,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  convertInchesToTwip,
} from "docx";

const outputPath = process.argv[2];
if (!outputPath) throw new Error("Usage: node create-dev-doc.js /absolute/path/output.docx");

const outputDir = path.dirname(outputPath);
const assetDir = path.join(outputDir, "docs-assets");

const T = String.raw;
const docTitle = T`鏈ㄥ彾涔夐娇璁捐骞冲彴 路 寮€鍙戞枃妗;
const palette = {
  dark: "1D3B2A",
  primary: "2A5139",
  light: "8FA89A",
  border: "D5DFD8",
  fill: "EEF3EF",
  warn: "B03A2E",
};

const font = {
  ascii: "Segoe UI",
  hAnsi: "Segoe UI",
  cs: "Segoe UI",
  eastAsia: "Microsoft YaHei",
};

const run = (text, options = {}) => new TextRun({ text, font, size: 22, ...options });
const para = (children, options = {}) =>
  new Paragraph({
    spacing: { after: 140, line: 300 },
    ...options,
    children: Array.isArray(children) ? children : [children],
  });
const body = (text, options = {}) =>
  para(run(text), { indent: { firstLine: convertInchesToTwip(0.33) }, ...options });
const bullet = (text) =>
  para(run(text), { indent: { left: convertInchesToTwip(0.33) }, bullet: undefined, numbering: undefined });
const h1 = (text) =>
  para(run(text, { bold: true, size: 30, color: palette.dark }), {
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 140 },
  });
const h2 = (text) =>
  para(run(text, { bold: true, size: 25, color: palette.primary }), {
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
  });
const note = (text) =>
  para(run(text, { color: "777777", size: 19 }), { spacing: { after: 100 } });
const caption = (text) =>
  para(run(text, { color: "666666", size: 19, italics: true }), {
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 200 },
  });

const cell = (text, options = {}) =>
  new TableCell({
    children: [para(run(String(text)), { spacing: { after: 0, line: 260 } })],
    margins: { top: 90, bottom: 90, left: 110, right: 110 },
    ...options,
  });

const table = (widths, header, rows) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: widths,
    rows: [
      new TableRow({
        children: header.map((t, i) =>
          cell(t, {
            shading: { type: ShadingType.CLEAR, fill: palette.fill },
            width: { size: widths[i], type: WidthType.DXA },
          }),
        ),
      }),
      ...rows.map(
        (r) =>
          new TableRow({
            children: r.map((t, i) => cell(t, { width: { size: widths[i], type: WidthType.DXA } })),
          }),
      ),
    ],
  });

const xmlEscape = (value) =>
  String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const toc = (entries) => {
  const cached = entries
    .map(({ title, level, page }) => {
      const indent = Math.max(0, level - 1) * 360;
      return `<w:p><w:pPr><w:pStyle w:val="TOC${level}"/>
        <w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9000"/></w:tabs>
        <w:ind w:left="${indent}"/></w:pPr>
        <w:r><w:t>${xmlEscape(title)}</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>${page}</w:t></w:r></w:p>`;
    })
    .join("");
  return ImportedXmlComponent.fromXmlString(`<w:sdt xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:sdtPr><w:alias w:val="鐩綍"/></w:sdtPr>
    <w:sdtContent>
      <w:p><w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/>
        <w:instrText xml:space="preserve"> TOC \\o &quot;1-3&quot; \\h \\z \\u </w:instrText>
        <w:fldChar w:fldCharType="separate"/></w:r></w:p>
      ${cached}
      <w:p><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>
    </w:sdtContent>
  </w:sdt>`).root[0];
};

const img = (file, w, h) =>
  para(new ImageRun({ type: "png", data: fs.readFileSync(path.join(assetDir, file)), transformation: { width: w, height: h } }), {
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 60 },
  });

/* ================= 鐩綍鏉＄洰 ================= */
const tocEntries = [
  { title: T`涓€銆侀」鐩杩癭, level: 1, page: 2 },
  { title: T`浜屻€佹妧鏈爤涓庨」鐩粨鏋刞, level: 1, page: 3 },
  { title: T`涓夈€佽鑹蹭笌鏉冮檺`, level: 1, page: 4 },
  { title: T`鍥涖€佹牳蹇冧笟鍔℃祦绋媊, level: 1, page: 5 },
  { title: T`4.1 璁㈠崟鐢熷懡鍛ㄦ湡`, level: 2, page: 5 },
  { title: T`4.2 鎶㈠崟涓庢墦鍥瀈, level: 2, page: 6 },
  { title: T`4.3 绉垎浣撶郴`, level: 2, page: 7 },
  { title: T`4.4 杩斿伐娴佺▼`, level: 2, page: 8 },
  { title: T`浜斻€佹暟鎹ā鍨媊, level: 1, page: 9 },
  { title: T`鍏€佸叧閿繍琛岄€昏緫锛堜唬鐮佸眰锛塦, level: 1, page: 11 },
  { title: T`涓冦€侀〉闈笌浜や簰娓呭崟`, level: 1, page: 12 },
  { title: T`鍏€佹紨绀鸿处鍙穈, level: 1, page: 13 },
  { title: T`涔濄€佸綋鍓嶇増鏈檺鍒朵笌涓婄嚎寤鸿`, level: 1, page: 14 },
  { title: T`鍗併€佸緟琛ュ厖浜嬮」锛堢暀鐧斤級`, level: 1, page: 15 },
];

/* ================= 姝ｆ枃 ================= */
const children = [];

// 灏侀潰
children.push(
  para(run(docTitle, { bold: true, size: 44, color: palette.dark }), {
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { before: 2400, after: 300 },
  }),
  para(run(T`杩炴帴鍖婚櫌 / 鍔犲伐鍘備笌杩滅▼璁捐甯堢殑鏁板瓧鍖栧缓妯″崗浣滃钩鍙癭, { color: palette.primary, size: 26 }), {
    alignment: AlignmentType.CENTER,
    spacing: { after: 1600 },
  }),
  para(run(T`鐗堟湰锛氭紨绀虹増 V1.0锛堝墠绔崟鏈虹増锛塦, { color: "777777" }), { alignment: AlignmentType.CENTER }),
  para(run(T`缂栧埗鏃ユ湡锛?026 骞?7 鏈?28 鏃, { color: "777777" }), { alignment: AlignmentType.CENTER }),
  para(run(T`璇存槑锛氭湰鏂囨。渚濇嵁褰撳墠宸插疄鐜扮殑缃戠珯鍔熻兘鏁寸悊锛屼緵绠＄悊鏂瑰闃呫€佽ˉ鍏呭悗浣滀负姝ｅ紡寮€鍙戜緷鎹€俙, { color: "777777" }), {
    alignment: AlignmentType.CENTER,
    pageBreakBefore: false,
  }),
);

// 鐩綍
children.push(
  para(run(T`鐩綍`, { bold: true, size: 30, color: palette.dark }), {
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 120 },
    pageBreakBefore: true,
  }),
  note(T`锛堝彸閿洰褰曢€夋嫨"鏇存柊鍩?鍙埛鏂伴〉鐮侊級`),
  toc(tocEntries),
);

// 涓€銆侀」鐩杩?children.push(
  h1(T`涓€銆侀」鐩杩癭),
  body(T`鏈ㄥ彾涔夐娇璁捐骞冲彴鏄竴涓潰鍚戜箟榻挎暟瀛楀寲璁捐鍗忎綔鐨勭綉绔欍€傚钩鍙拌繛鎺ヤ笁绫讳娇鐢ㄨ€咃細鍖婚櫌 / 鍔犲伐鍘傦紙涓嬪崟瀹㈡埛锛夈€佽繙绋嬭璁″笀锛堟帴鍗曡璁★級銆佸钩鍙扮鐞嗘柟锛堟渶楂樻潈闄愶級銆傚鎴锋彁浜ょ墮浣嶈璁￠渶姹傚苟涓婁紶鍙ｆ壂鏂囦欢涓庣収鐗囷紝璁捐甯堝湪鎺ュ崟澶у巺鎶㈠崟骞跺畬鎴愯璁＄锛屽鎴蜂笅杞借璁℃枃浠讹紝褰㈡垚瀹屾暣闂幆銆俙),
  body(T`骞冲彴瀹氫綅涓?鎻愪緵浜ゆ帴鐨勭幆澧?锛氬钩鍙颁粎鎻愪緵鏁板瓧鍖栧缓妯℃妧鏈湇鍔★紝涓嶅鏈€缁堜箟榻跨殑涓村簥鏁堟灉銆佸尰鐤楀櫒姊拌川閲忔壙鎷呰矗浠汇€傝鍏嶈矗澹版槑鍥哄畾灞曠ず浜庢瘡涓〉闈㈢殑搴曢儴銆俙),
  h2(T`1.1 涓夋潯鏍稿績鍟嗕笟瑙勫垯`),
  body(T`鈶?绉垎鍒讹細瀹㈡埛閫氳繃寰俊杞处缁欑鐞嗘柟锛岀敱绠＄悊鏂瑰湪鍚庡彴鎵嬪姩鍏呭€肩Н鍒嗭紱鎻愪氦璁㈠崟鏃舵寜"璁捐绫诲瀷 脳 鐗欎綅鏁伴噺"棰勬墸绉垎锛岀Н鍒嗕笉瓒虫棤娉曚笅鍗曘€傜Н鍒嗚В閲婃潈褰掑钩鍙扮鐞嗘柟鎵€鏈夈€俙),
  body(T`鈶?鎶㈠崟鍒讹細鏂拌鍗曡繘鍏ユ帴鍗曞ぇ鍘呭悗鍏ㄤ綋璁捐甯堝彲瑙侊紝鍏堝埌鍏堝緱锛涜鍗曡鎺ュ崟鍚庣珛鍗充粠澶у巺娑堝け銆俙),
  body(T`鈶?瀹屾垚鏍囧噯锛氳璁″笀涓婁紶璁捐鏂囦欢骞舵彁浜わ紝璁㈠崟鍗充负瀹屾垚銆傝璁″笀鍙戠幇淇℃伅涓嶅叏鎴栨暟鎹湁闂鏃讹紝鍙皢璁㈠崟鎵撳洖缁欏鎴蜂慨鏀广€俙),
  h2(T`1.2 闅愮涓庨殧绂诲師鍒檂),
  body(T`璁捐甯堢鍙樉绀鸿鍗曞崟鍙枫€佺墮浣嶃€佽璁¤姹傘€佸彛鎵枃浠朵笌鐓х墖锛屼笉鏄剧ず娲惧崟鏉ユ簮锛堝摢瀹跺尰闄?鍔犲伐鍘傦級锛屼篃涓嶆樉绀轰换浣曠Н鍒嗕俊鎭紱瀹㈡埛璐﹀崟涓璁″笀浠呮樉绀?X 甯堝倕"銆傛淳鍗曟潵婧愪粎绠＄悊绔彲瑙併€俙),
);

// 浜屻€佹妧鏈爤
children.push(
  h1(T`浜屻€佹妧鏈爤涓庨」鐩粨鏋刞),
  body(T`褰撳墠鐗堟湰涓哄墠绔崟鏈烘紨绀虹増锛氭墍鏈夋暟鎹繚瀛樺湪娴忚鍣ㄧ殑 localStorage 涓紙瀛樻牴閿?muye-design-platform-v4锛夛紝鏃犻渶鏈嶅姟鍣ㄥ嵆鍙畬鏁存紨绀哄叏閮ㄤ笟鍔℃祦绋嬨€傛寮忎笂绾挎椂闇€瑕佹浛鎹负鍚庣鏈嶅姟涓庢暟鎹簱锛堣绗節绔狅級銆俙),
  table(
    [2200, 3600, 3400],
    [T`灞傞潰`, T`鎶€鏈€夊瀷`, T`璇存槑`],
    [
      [T`鍓嶇妗嗘灦`, T`React 18 + TypeScript`, T`涓夌鍏辩敤涓€濂椾唬鐮侊紝鎸夌櫥褰曡鑹插垎娴乣],
      [T`鏋勫缓宸ュ叿`, T`Vite 7`, T`npm run dev 鏈湴棰勮锛宯pm run build 鎵撳寘`],
      [T`鏍峰紡`, T`Tailwind CSS + shadcn/ui`, T`鍝佺墝鑹叉繁缁?#1D3B2A`],
      [T`鏁版嵁灞俙, T`src/lib/store.ts锛堣嚜瀹炵幇锛塦, T`localStorage 鎸佷箙鍖?+ useSyncExternalStore 璁㈤槄鍒锋柊`],
      [T`鏁版嵁妯″瀷`, T`src/types/index.ts`, T`璁㈠崟 / 绉垎娴佹按 / 璐﹀彿绛?TypeScript 绫诲瀷瀹氫箟`],
      [T`鏂囦欢澶勭悊`, T`FileReader锛堝墠绔級`, T`灏忎簬 1.5MB 鐨勬枃浠跺唴宓?dataUrl 鍙笅杞斤紝澶ф枃浠朵粎璁板綍鏂囦欢鍚峘],
    ],
  ),
  h2(T`2.1 鐩綍缁撴瀯`),
  table(
    [3400, 5800],
    [T`鏂囦欢 / 鐩綍`, T`浣滅敤`],
    [
      [T`website/src/App.tsx`, T`鎬诲叆鍙ｏ細椤舵爮銆佺櫥褰曞垎娴併€侀〉鑴氬厤璐ｅ０鏄巂],
      [T`website/src/sections/Login.tsx`, T`鐧诲綍椤碉紙浠呰处鍙?瀵嗙爜锛屽惈婕旂ず璐﹀彿鎶樺彔鍖猴級`],
      [T`website/src/sections/ClientApp.tsx`, T`鍖婚櫌/鍔犲伐鍘傜锛氭彁浜よ鍗曘€佹垜鐨勮鍗曘€佺Н鍒嗘槑缁嗐€佹秷鎭痐],
      [T`website/src/sections/DesignerApp.tsx`, T`璁捐甯堢锛氭帴鍗曞ぇ鍘呫€佹垜鐨勮鍗曘€佹墦鍥炪€佹彁浜よ璁℃枃浠禶],
      [T`website/src/sections/AdminApp.tsx`, T`绠＄悊绔細璐﹀彿绠＄悊銆佺Н鍒嗙鐞嗐€佽鍗曟€昏銆佽处鍗曚腑蹇冦€佽璁″笀鍒嗙粍`],
      [T`website/src/components/ToothChart.tsx`, T`鐗欎綅鍥剧粍浠讹紙涓婇/涓嬮鍒嗗尯閫夋嫨锛塦],
      [T`website/src/components/bits.tsx`, T`閫氱敤灏忕粍浠讹紙鐘舵€佸窘绔犮€佹枃浠朵笅杞芥爣绛俱€佽〃鍗曟牱寮忕瓑锛塦],
      [T`website/src/lib/store.ts`, T`鍏ㄩ儴涓氬姟閫昏緫锛氫笅鍗曘€佹姠鍗曘€佹墦鍥炪€佺Н鍒嗐€佽处鍙风鐞嗙瓑`],
      [T`website/public/logo*.png`, T`鍝佺墝 logo 璧勪骇锛堝僵鑹插浘鏍?/ 瀹屾暣甯︽枃瀛楃増锛塦],
    ],
  ),
);

// 涓夈€佽鑹蹭笌鏉冮檺
children.push(
  h1(T`涓夈€佽鑹蹭笌鏉冮檺`),
  body(T`鐧诲綍椤典粎鏄剧ず璐﹀彿涓庡瘑鐮佷袱涓緭鍏ユ锛岀郴缁熸牴鎹处鍙疯鑹茶嚜鍔ㄨ繘鍏ュ搴旂鍙ｃ€傛墍鏈夎处鍙峰潎鐢辩鐞嗙缁熶竴鍒涘缓锛屽尰闄?鍔犲伐鍘備笌璁捐甯堜笉鑳借嚜琛屾敞鍐屻€俙),
  img("flow-1-login.png", 470, 275),
  caption(T`鍥?1  鐧诲綍涓庤鑹插垎娴乣),
  table(
    [1900, 2500, 2500, 2300],
    [T`鍔熻兘`, T`鍖婚櫌/鍔犲伐鍘傜`, T`璁捐甯堢`, T`绠＄悊绔痐],
    [
      [T`鎻愪氦璁捐璁㈠崟`, T`鉁旓紙棰勬墸绉垎锛塦, T`鈥擿, T`鈥擿],
      [T`涓婁紶鍙ｆ壂鏂囦欢/鐓х墖`, T`鉁旓紙鍧囧繀濉級`, T`鈥擿, T`鍙煡鐪?涓嬭浇`],
      [T`鎺ュ崟锛堟姠鍗曪級`, T`鈥擿, T`鉁擿, T`鈥擿],
      [T`鎵撳洖璁㈠崟`, T`鈥擿, T`鉁旓紙闇€濉啓鍘熷洜锛塦, T`鈥擿],
      [T`涓嬭浇璁捐鏂囦欢`, T`鉁擿, T`鈥擿, T`鉁擿],
      [T`绉垎浣欓涓庢槑缁哷, T`鉁?鍙`, T`涓嶅彲瑙乣, T`鉁?鍙厖鍊?鎵ｅ噺`],
      [T`娲惧崟鏉ユ簮`, T`浠呰鑷繁璁㈠崟`, T`涓嶅彲瑙乣, T`鉁?鍏ㄩ儴鍙`],
      [T`鍒涘缓璐﹀彿/鏀瑰瘑鐮乣, T`鈥擿, T`鈥擿, T`鉁旓紙鏈€楂樻潈闄愶級`],
      [T`鏈堝害璐﹀崟`, T`鈥擿, T`鈥擿, T`鉁旓紙鍙鍑?CSV锛塦],
      [T`璁捐甯堝垎缁?缁勯暱`, T`鈥擿, T`鈥擿, T`鉁擿],
    ],
  ),
);

// 鍥涖€佹牳蹇冧笟鍔℃祦绋?children.push(
  h1(T`鍥涖€佹牳蹇冧笟鍔℃祦绋媊),
  h2(T`4.1 璁㈠崟鐢熷懡鍛ㄦ湡`),
  body(T`璁㈠崟鍏变簲绉嶇姸鎬侊細寰呮帴鍗曘€佽璁′腑銆佸凡瀹屾垚銆佸凡鎵撳洖銆佽繑宸ヤ腑锛堣繑宸ヨ鍗曢噸鏂拌繘鍏ユ帴鍗曞ぇ鍘咃級銆傚畬鏁存祦杞涓嬶細`),
  img("flow-2-order.png", 480, 316),
  caption(T`鍥?2  璁㈠崟鐘舵€佹祦杞琡),
  table(
    [1500, 2600, 5100],
    [T`鐘舵€乣, T`瑙﹀彂鍔ㄤ綔`, T`璇存槑`],
    [
      [T`寰呮帴鍗昤, T`瀹㈡埛鎻愪氦璁㈠崟`, T`鎻愪氦鏃剁珛鍗抽鎵ｇН鍒嗭紱浣欓涓嶈冻鍒欐彁浜ゅけ璐ワ紝鎻愮ず"绉垎涓嶈冻锛岃鑱旂郴绠＄悊鏂瑰厖鍊?`],
      [T`璁捐涓璥, T`璁捐甯堢偣鍑?鎺ュ崟"`, T`璁板綍鎺ュ崟璁捐甯堜笌鎺ュ崟鏃堕棿锛岃鍗曚粠澶у巺娑堝け`],
      [T`宸插畬鎴恅, T`璁捐甯堟彁浜よ璁℃枃浠禶, T`璁㈠崟瀹屾垚锛屽鎴锋敹鍒板畬鎴愭彁閱掞紝鍙笅杞借璁℃枃浠讹紱姝ょ幆鑺備笉鍐嶆墸绉垎`],
      [T`宸叉墦鍥瀈, T`璁捐甯堢偣鍑?鎵撳洖"`, T`闇€濉啓鍘熷洜锛堜俊鎭笉鍏?鏁版嵁鏈夐棶棰橈級锛涜鍗曢€€鍥炲鎴凤紝娓呴櫎鍘熻璁″笀`],
      [T`杩斿伐涓璥, T`瀹㈡埛瀵瑰凡瀹屾垚璁㈠崟鐢宠杩斿伐`, T`璁㈠崟甯?杩斿伐"鏍囪鍥炲埌鎺ュ崟澶у巺锛屽師杩斿伐瑕佹眰闅忓崟灞曠ず锛涜繑宸ュ崟涓嶉噸澶嶆墸绉垎`],
    ],
  ),
  body(T`琚墦鍥炵殑璁㈠崟鐢卞鎴蜂慨鏀癸紙鍙敼鐗欎綅涓庤姹傦級鍚庨噸鏂版彁浜わ細绯荤粺鎸夋柊鐗欎綅閲嶆柊璁＄畻绉垎锛屼笌鍘熼鎵ｇН鍒?澶氶€€灏戣ˉ"鈥斺€旈渶琛ユ墸鑰屼綑棰濅笉瓒虫椂涓嶅厑璁告彁浜ゃ€俙),
  h2(T`4.2 鎶㈠崟涓庢墦鍥瀈),
  img("flow-4-grab.png", 470, 296),
  caption(T`鍥?3  鎶㈠崟涓庢墦鍥炴祦绋媊),
  body(T`璁捐甯堝湪鎺ュ崟澶у巺鍙煡鐪嬭鍗曡鎯咃紙鐗欎綅鍥俱€佽璁¤姹傘€佸彛鎵枃浠躲€佺収鐗囷級鍚庡喅瀹氭帴鍗曟垨鎵撳洖銆傚悓涓€璁㈠崟琚帴鍗曞悗绔嬪嵆浠庡ぇ鍘呮秷澶憋紝鍏朵粬璁捐甯堜笉鍙啀鎺ワ紱鎵撳洖鍗曟竻闄ゅ師璁捐甯堬紝瀹㈡埛琛ラ綈璧勬枡閲嶆柊鎻愪氦鍚庡啀娆℃帓闃熴€俙),
  h2(T`4.3 绉垎浣撶郴`),
  img("flow-3-points.png", 470, 316),
  caption(T`鍥?4  绉垎娴佽浆`),
  table(
    [3400, 2200, 3600],
    [T`璁捐绫诲瀷`, T`绉垎鍗曚环`, T`澶囨敞`],
    [
      [T`鍗冲埢璁捐`, T`8 鍒?/ 棰梎, T`椤甸潰鏍囨敞"鍔犳€ヤ欢"鏃舵寜绠＄悊鏂硅鍒欏鐞哷],
      [T`鍏ㄧ摲鍐?/ 鍩哄彴涓婇儴鍐燻, T`5 鍒?/ 棰梎, T`鈥擿],
      [T`璐撮潰 / 宓屼綋璁捐`, T`10 鍒?/ 棰梎, T`鍔犳€ユ瘡棰?+5 鍒嗭紝鍔犳€ヤ欢绾㈣壊鏍囪瘑`],
    ],
  ),
  body(T`绉垎瑙勫垯瑕佺偣锛氣憼 鍏呭€间粎鐢辩鐞嗙鎵嬪姩鎿嶄綔锛堝鎴峰井淇¤浆璐﹀悗鍏呭€硷級锛涒憽 鎻愪氦璁㈠崟鍗抽鎵ｏ紝璁㈠崟瀹屾垚涓嶅啀閲嶅鎵ｏ紱鈶?鎵撳洖鍚庨噸鏂版彁浜ゆ寜鏂扮墮浣嶅閫€灏戣ˉ锛涒懀 杩斿伐鍗曚笉鎵ｇН鍒嗭紱鈶?鍖婚櫌绔彲瑙佷綑棰濅笌绉垎鏄庣粏锛岃璁″笀绔畬鍏ㄤ笉鍙绉垎锛涒懃 绉垎瑙ｉ噴鏉冨綊骞冲彴绠＄悊鏂规墍鏈夈€俙),
  h2(T`4.4 杩斿伐娴佺▼`),
  body(T`瀹㈡埛瀵瑰凡瀹屾垚璁㈠崟濉啓杩斿伐瑕佹眰鍚庯紝璁㈠崟甯?杩斿伐"绾㈡爣鍥炲埌鎺ュ崟澶у巺閲嶆柊鎺掗槦锛屼换浣曡璁″笀鍧囧彲鎺ワ紙涓嶄竴瀹氬洖鍒板師璁捐甯堟墜涓級銆傝繑宸ュ畬鎴愬悗璁″叆褰撴湀璐﹀崟鐨?杩斿伐"鍒楋紝涓嶉噸澶嶆墸瀹㈡埛绉垎銆傝繑宸ョ殑鍏蜂綋鍒ゅ畾鏍囧噯涓庢鏁伴檺鍒剁洰鍓嶅緟瀹氾紝寰呯鐞嗘柟琛ュ厖瑙勫垯鍚庡疄鐜般€俙),
);

// 浜斻€佹暟鎹ā鍨?children.push(
  h1(T`浜斻€佹暟鎹ā鍨媊),
  body(T`浠ヤ笅涓哄綋鍓嶇増鏈殑鏍稿績鏁版嵁缁撴瀯锛圱ypeScript 鎺ュ彛锛夛紝姝ｅ紡鍚庣寤哄簱鏃跺彲鐩存帴瀵圭収寤鸿〃銆俙),
  h2(T`5.1 璁㈠崟 Order`),
  table(
    [2300, 1900, 5000],
    [T`瀛楁`, T`绫诲瀷`, T`璇存槑`],
    [
      [T`no`, T`瀛楃涓瞏, T`鍗曞彿锛屾牸寮?MY-YYMMDD-搴忓彿锛屽 MY-260721-005`],
      [T`clientId / designerId`, T`寮曠敤`, T`涓嬪崟瀹㈡埛 / 鎺ュ崟璁捐甯堬紙鏈帴鍗曟椂涓虹┖锛塦],
      [T`type`, T`鏋氫妇`, T`jike 鍗冲埢璁捐 / quanci 鍏ㄧ摲鍐犅峰熀鍙颁笂閮ㄥ啝 / tiemian 璐撮潰路宓屼綋`],
      [T`urgent`, T`甯冨皵`, T`鏄惁鍔犳€ワ紙浠呰创闈⒙峰祵浣撳紑鏀惧姞鎬ラ€夐」锛塦],
      [T`teeth`, T`鐗欎綅鏁扮粍`, T`鐗欎綅缂栫爜锛歎/D锛堜笂/涓嬮锛? L/R锛堝乏/鍙筹級+ 1-7锛屽 UL3`],
      [T`requirement`, T`瀛楃涓瞏, T`璁捐瑕佹眰鏂囧瓧`],
      [T`scanFiles`, T`鏂囦欢鏁扮粍`, T`鍙ｆ壂鏂囦欢锛屽繀濉紝涓嶉檺鏍煎紡`],
      [T`images`, T`鍥剧墖鏁扮粍`, T`鐓х墖锛屽繀濉紝鑷冲皯 1 寮燻],
      [T`designFiles`, T`鏂囦欢鏁扮粍`, T`璁捐甯堟彁浜ょ殑璁捐鏂囦欢`],
      [T`status`, T`鏋氫妇`, T`pending / designing / completed / rework / returned`],
      [T`points`, T`鏁板瓧`, T`鏈崟绉垎锛堟彁浜ゆ椂棰勬墸锛塦],
      [T`isRework / reworkCount / reworkReason`, T`鈥擿, T`杩斿伐鏍囪銆佹鏁般€佽繑宸ヨ姹俙],
      [T`returnReason`, T`瀛楃涓瞏, T`璁捐甯堟墦鍥炲師鍥燻],
      [T`createdAt / acceptedAt / completedAt`, T`鏃堕棿`, T`鎻愪氦 / 鎺ュ崟 / 瀹屾垚鏃堕棿`],
    ],
  ),
  h2(T`5.2 鍏朵綑瀹炰綋`),
  table(
    [2200, 7000],
    [T`瀹炰綋`, T`鍏抽敭瀛楁涓庤鏄巂],
    [
      [T`Client 瀹㈡埛`, T`鍚嶇О銆佺數璇濄€佺被鍨嬶紙鍖婚櫌/鍔犲伐鍘傦級銆佺Н鍒嗕綑棰漙],
      [T`Designer 璁捐甯坄, T`濮撳悕銆佺數璇濄€佽韩浠借瘉鍙枫€佹妧宸ヨ瘉鍙凤紙閫夊～锛夈€佹墍灞炲垎缁勶紱瀵瑰鎴蜂粎鏄剧ず"X 甯堝倕"`],
      [T`Group 鍒嗙粍`, T`缁勫悕锛堝彲闅忔椂鏀癸級銆佺粍闀匡紙姣忕粍涓€鍚嶏紝鍙笉璁撅級`],
      [T`PointTxn 绉垎娴佹按`, T`鍙樺姩鍊硷紙璐熸暟涓烘墸鍑忥級銆佸彉鍔ㄥ悗浣欓銆佷簨鐢便€佸叧鑱旇鍗曘€佹椂闂达紱鍖婚櫌绔彲瑙佽嚜宸辩殑鏄庣粏`],
      [T`Notice 娑堟伅`, T`璁㈠崟瀹屾垚/琚墦鍥炴椂鑷姩浜х敓锛屽鎴风鍙煡鐪嬪苟鏍囪宸茶`],
      [T`Account 璐﹀彿`, T`璐﹀彿鍚嶃€佸瘑鐮併€佽鑹层€佸叧鑱旂殑瀹㈡埛鎴栬璁″笀妗ｆ锛涗粎绠＄悊绔彲鍒涘缓/鏀瑰瘑/鍒犻櫎锛堢鐞嗙璐﹀彿涓嶅彲鍒狅級`],
    ],
  ),
);

// 鍏€佸叧閿繍琛岄€昏緫
children.push(
  h1(T`鍏€佸叧閿繍琛岄€昏緫锛堜唬鐮佸眰锛塦),
  body(T`鍏ㄩ儴涓氬姟鍔ㄤ綔闆嗕腑鍦?website/src/lib/store.ts锛屾瘡涓姩浣滄墽琛屽悗绔嬪嵆鍐欏叆 localStorage 骞堕€氱煡鐣岄潰鍒锋柊銆備富瑕佸嚱鏁板涓嬶細`),
  table(
    [2600, 6600],
    [T`鍑芥暟`, T`閫昏緫`],
    [
      [T`orderPoints`, T`璁㈠崟绉垎 =锛堢被鍨嬪崟浠?+ 鍔犳€ラ檮鍔狅級脳 鐗欎綅鏁癭],
      [T`createOrder`, T`鏍￠獙浣欓 鈫?鐢熸垚鍗曞彿 鈫?棰勬墸绉垎骞惰娴佹按 鈫?璁㈠崟杩涘叆寰呮帴鍗曪紱浣欓涓嶈冻杩斿洖 null锛堢晫闈㈡彁绀哄厖鍊硷級`],
      [T`acceptOrder`, T`浠?寰呮帴鍗?杩斿伐"鐘舵€佸彲鎺ワ紱鍐欏叆璁捐甯堜笌鎺ュ崟鏃堕棿锛岀姸鎬佸彉璁捐涓璥],
      [T`submitDesign`, T`浠?璁捐涓?鍙彁浜わ紱鍐欏叆璁捐鏂囦欢銆佸畬鎴愭椂闂达紝鐘舵€佸彉宸插畬鎴愶紝骞剁粰瀹㈡埛鍙戝畬鎴愭彁閱掞紱涓嶅啀鎵ｇН鍒哷],
      [T`returnOrder`, T`寰呮帴鍗?璁捐涓彲鎵撳洖锛涚姸鎬佸彉宸叉墦鍥炪€佹竻闄よ璁″笀锛屽苟缁欏鎴峰彂鎻愰啋`],
      [T`resubmitOrder`, T`宸叉墦鍥炶鍗曚慨鏀瑰悗閲嶆柊鎻愪氦锛氭寜鏂扮墮浣嶉噸绠楃Н鍒嗗閫€灏戣ˉ锛岃ˉ鎵ｄ笉瓒冲垯鎷掔粷鎻愪氦锛岀姸鎬佸洖鍒板緟鎺ュ崟`],
      [T`requestRework`, T`宸插畬鎴愯鍗曠敵璇疯繑宸ワ細杩斿伐娆℃暟+1锛屾竻闄よ璁″笀锛屽洖鍒版帴鍗曞ぇ鍘卄],
      [T`adjustPoints`, T`绠＄悊绔墜鍔ㄥ厖鍊?鎵ｅ噺锛岃褰曟祦姘达紙鍙樺姩鍊笺€佷綑棰濄€佷簨鐢憋級`],
      [T`createAccount / resetPassword / deleteAccount`, T`绠＄悊绔缓鍙凤紙鍙悓鏃舵柊寤烘。妗堬級銆佹敼瀵嗐€佸垹鍙凤紱admin 璐﹀彿涓嶅彲鍒犻櫎`],
      [T`readOrderFile`, T`涓婁紶鏂囦欢璇诲彇锛氣墹1.5MB 鍐呭祵 dataUrl 渚涗笅杞斤紝瓒呰繃浠呬繚鐣欐枃浠跺悕锛堟紨绀虹増闄愬埗锛塦],
    ],
  ),
  note(T`鐗欎綅鍥炬寜涓婇 / 涓嬮鍒嗗尯灞曠ず锛岀紪鐮佽鍒欙細U=涓婇锛孌=涓嬮锛孡=宸︼紝R=鍙筹紝鏁板瓧 1-7锛堝 UR6=涓婇鍙充晶绗?6 棰楋級銆俙),
);

// 涓冦€侀〉闈笌浜や簰娓呭崟
children.push(
  h1(T`涓冦€侀〉闈笌浜や簰娓呭崟`),
  table(
    [1800, 2500, 4900],
    [T`绔彛`, T`椤甸潰 / 鏍囩`, T`涓昏鍐呭涓庝氦浜抈],
    [
      [T`鐧诲綍椤礰, T`鈥擿, T`鍝佺墝灏侀潰锛堢墮榻?鍙跺瓙鍏冪礌锛夈€佽处鍙?瀵嗙爜銆佸瘑鐮佸彲瑙佸垏鎹€佹紨绀鸿处鍙锋姌鍙犲尯`],
      [T`鍖婚櫌/鍔犲伐鍘傜`, T`鎻愪氦鏂拌鍗昤, T`鐗欎綅鍥鹃€夋嫨銆佽璁＄被鍨嬶紙鍚孩鑹?鍔犳€ヤ欢"鏍囪瘑锛夈€佽璁¤姹傘€佸彛鎵枃浠讹紙蹇呭～锛夈€佺収鐗囷紙蹇呭～锛夈€佸疄鏃舵樉绀烘墍闇€绉垎`],
      [T`鍖婚櫌/鍔犲伐鍘傜`, T`鎴戠殑璁㈠崟`, T`璁㈠崟鐘舵€佽窡韪€佽鎵撳洖璁㈠崟淇敼閲嶆彁銆佽繑宸ョ敵璇枫€佽璁℃枃浠朵笅杞絗],
      [T`鍖婚櫌/鍔犲伐鍘傜`, T`绉垎鏄庣粏`, T`褰撳墠浣欓 + 姣忕瑪娴佹按锛堝厖鍊?棰勬墸/琛ユ墸/閫€鍥烇級`],
      [T`鍖婚櫌/鍔犲伐鍘傜`, T`娑堟伅`, T`璁㈠崟瀹屾垚涓庤鎵撳洖鎻愰啋`],
      [T`璁捐甯堢`, T`鎺ュ崟澶у巺`, T`璁㈠崟鍗＄墖锛堢墮浣?瑕佹眰/鏂囦欢鏁伴噺锛夈€佸睍寮€璇︽儏銆佹帴鍗曘€佹墦鍥瀈],
      [T`璁捐甯堢`, T`鎴戠殑璁㈠崟`, T`杩涜涓鍗曘€佸彛鎵枃浠朵笅杞姐€佷笂浼犺璁℃枃浠跺畬鎴愯鍗曘€佹墦鍥瀈],
      [T`绠＄悊绔痐, T`璐﹀彿绠＄悊`, T`鍒涘缓璐﹀彿锛堟柊寤?鍏宠仈妗ｆ锛夈€佷慨鏀瑰瘑鐮併€佸垹闄よ处鍙穈],
      [T`绠＄悊绔痐, T`绉垎绠＄悊`, T`鍚勫鎴蜂綑棰濄€佹墜鍔ㄥ厖鍊?鎵ｅ噺銆佸叏閮ㄧН鍒嗘祦姘碻],
      [T`绠＄悊绔痐, T`璁㈠崟鎬昏`, T`鍏ㄩ儴璁㈠崟锛堝惈鏉ユ簮锛夈€佸睍寮€鏌ョ湅鐓х墖涓庡彛鎵?璁捐鏂囦欢`],
      [T`绠＄悊绔痐, T`璐﹀崟涓績`, T`鎸夋湀鐢熸垚瀹㈡埛涓庤璁″笀璐﹀崟锛屽彲瀵煎嚭 CSV`],
      [T`绠＄悊绔痐, T`璁捐甯堝垎缁刞, T`鍒嗙粍鏀瑰悕銆佽缁勯暱銆佽皟缁勬垚鍛榒],
    ],
  ),
);

// 鍏€佹紨绀鸿处鍙?children.push(
  h1(T`鍏€佹紨绀鸿处鍙穈),
  table(
    [2200, 2200, 2200, 2600],
    [T`绔彛`, T`璐﹀彿`, T`瀵嗙爜`, T`璇存槑`],
    [
      [T`绠＄悊绔痐, T`admin`, T`muye2026`, T`鏈€楂樻潈闄恅],
      [T`鍖婚櫌/鍔犲伐鍘俙, T`mingzhou / hengmei / yahe`, T`123456`, T`鏄庡窞鍙ｈ厰鍖婚櫌 / 鎭掔編涔夐娇鍔犲伐鍘?/ 闆呯鍙ｈ厰闂ㄨ瘖閮╜],
      [T`璁捐甯坄, T`li / wang / zhao / sun / zhou`, T`123456`, T`鍒嗗睘 A-D 鍚勫垎缁刞],
    ],
  ),
  note(T`绯荤粺鍐呯疆 5 绗旀紨绀鸿鍗曚笌绉垎娴佹按锛岃鐩栧緟鎺ュ崟銆佽璁′腑銆佸凡瀹屾垚銆佽繑宸ョ瓑鍏ㄩ儴鐘舵€侊紝渚夸簬婕旂ず銆俙),
);

// 涔濄€侀檺鍒朵笌涓婄嚎寤鸿
children.push(
  h1(T`涔濄€佸綋鍓嶇増鏈檺鍒朵笌涓婄嚎寤鸿`),
  h2(T`9.1 婕旂ず鐗堥檺鍒禶),
  body(T`鈶?鏁版嵁淇濆瓨鍦ㄥ悇鑷數鑴戞祻瑙堝櫒閲岋紝鎹㈢數鑴?鎹㈡祻瑙堝櫒鏁版嵁涓嶄簰閫氾紝澶氫汉鏃犳硶鐪熸鍗忓悓锛涒憽 澶т簬 1.5MB 鐨勬枃浠跺彧淇濈暀鏂囦欢鍚嶏紝涓嶈兘涓嬭浇鐪熷疄鍐呭锛涒憿 鎶㈠崟娌℃湁骞跺彂閿侊紝姝ｅ紡涓婄嚎闇€鏈嶅姟绔繚璇?鍚屼竴璁㈠崟鍙涓€浜烘帴鍒?锛涒懀 瀵嗙爜涓烘槑鏂囧瓨鍌紝浠呯敤浜庢紨绀恒€俙),
  h2(T`9.2 姝ｅ紡涓婄嚎闇€瑕佽ˉ鍏卄),
  body(T`鈶?鍚庣鏈嶅姟涓庢暟鎹簱锛堣处鍙枫€佽鍗曘€佺Н鍒嗘祦姘淬€佹枃浠跺瓨鍌級锛涒憽 澶ф枃浠跺璞″瓨鍌紙鍙ｆ壂 STL 閫氬父鍑犲崄鍒板嚑鐧?MB锛夛紱鈶?鐧诲綍瀹夊叏锛堝瘑鐮佸姞瀵嗐€侀獙璇佺爜銆佷細璇濊繃鏈燂級锛涒懀 鎿嶄綔鏃ュ織涓庢暟鎹浠斤紱鈶?鍩熷悕銆佹湇鍔″櫒涓庡妗堬紱鈶?鍖婚櫌瀵规帴鐨勫悎瑙勬潯娆撅紙鎮ｈ€呭奖鍍忚祫鏂欑殑淇濆瘑鍗忚锛夈€俙),
);

// 鍗併€佸緟琛ュ厖
children.push(
  h1(T`鍗併€佸緟琛ュ厖浜嬮」锛堢暀鐧斤級`),
  body(T`浠ヤ笅浜嬮」鐩墠涓?寰呭畾"鎴栭渶瑕佺鐞嗘柟琛ュ厖锛岃鐩存帴鍦ㄦ湰鏂囨。涓～鍐欙紝鎴戜滑灏嗘寜琛ュ厖鍐呭缁х画寮€鍙戯細`),
  table(
    [3000, 6200],
    [T`浜嬮」`, T`寰呰ˉ鍏呭唴瀹筦],
    [
      [T`杩斿伐瑙勫垯`, T`杩斿伐鍒ゅ畾鏍囧噯銆佹鏁伴檺鍒躲€佹槸鍚﹀繀椤诲洖鍒板師璁捐甯堬細锛匡伎锛匡伎锛匡伎锛匡伎`],
      [T`鐗欎綅鍥句慨鏀规柟妗坄, T`鐗欎綅鍥惧悗缁皟鏁撮渶姹傦細锛匡伎锛匡伎锛匡伎锛匡伎`],
      [T`鍔犳€ヨ鍒檂, T`鍚勭被鍨嬬殑鍔犳€ュ紑鏀捐寖鍥翠笌鍔犳€ュ崟浠凤細锛匡伎锛匡伎锛匡伎锛匡伎`],
      [T`绉垎瀹氫环`, T`鍚勭被鍨嬪崟浠锋槸鍚﹁皟鏁淬€佸厖鍊兼。浣嶏細锛匡伎锛匡伎锛匡伎锛匡伎`],
      [T`鍏朵粬`, T`锛匡伎锛匡伎锛匡伎锛匡伎锛匡伎锛匡伎锛匡伎锛匡伎锛匡伎锛匡伎`],
    ],
  ),
);


// 十一、近期优化记录
children.push(
  h1('十一、近期优化记录'),
  body('以下为 V1.0 演示版发布后的代码质量与用户体验优化项，于 2026 年 7 月 30 日完成。'),
  h2('11.1 代码健壮性'),
  table(
    [3000, 6200],
    ['优化项', '说明'],
    [
      ['文件上传竞争条件修复', 'pickScans 使用 useRef 追踪并发上传队列，解决连续选文件时 scanFiles.length 陈旧值问题；pickImages 改用函数式更新避免闭包过期'],
      ['提交/抢单防抖', '订单提交按钮使用 submitting 状态机防止重复提交；接单大厅按钮用 window.__grabLock 做 500ms 防抖'],
      ['样式常量转 cva()', 'btnPrimary / btnGhost / inputCls 转换为 class-variance-authority 的 cva() 定义，支持 variant 扩展'],
      ['Admin 订单总览 Fragment', 'Orders 组件中 .map() 返回的数组模式修改为 Fragment，提升可维护性'],
    ],
  ),
  h2('11.2 用户体验'),
  table(
    [3000, 6200],
    ['优化项', '说明'],
    [
      ['提交确认弹窗', '订单提交前弹出 AlertDialog 确认框，显示即将消耗的积分与当前余额，防止误操作'],
      ['表单校验', '创建账号时校验手机号（11 位）与身份证号（18 位）；上传照片时校验不超过 10MB'],
      ['按钮 type 补充', '所有非提交按钮添加 type="button"，防止表单内误触发 submit'],
      ['编码修复', '修复 index.html 标题乱码（原 GBK 编码导致浏览器显示为"鏈ㄥ彾涔夐娇"），全部源码统一为 UTF-8'],
      ['a11y 补充', '补充 img alt 文本、密码可见切换按钮的 aria-label'],
    ],
  ),
);

// 十二、分组匹配功能
children.push(
  h1('十二、分组匹配功能'),
  body('分组匹配功能于 V1.1 版本新增，将平台从「全员抢单」升级为「分组匹配 + 公海兜底」模式，解决医院/加工厂与设计师之间的固定协作关系需求。'),
  h2('12.1 数据模型变更'),
  table(
    [3000, 6200],
    ['变更', '说明'],
    [
      ['ClientGroup 实体', '新增客户分组实体（id, name, note, createdAt），管理端将客户按区域或业务归类'],
      ['Group.note 字段', '设计师分组新增 note 备注字段，管理端可自由添加如"白班·全能型"等描述'],
      ['Client.clientGroupId', '客户新增所属分组字段，在创建账号时由管理端分配'],
      ['GroupAssignment 实体', '新增客户组↔设计师组的 M:N 匹配规则表，决定订单路由'],
      ['OrderStatus.unassigned', '新增「未分配」订单状态，客户组无匹配设计师组时订单自动进入此状态'],
    ],
  ),
  h2('12.2 管理端功能'),
  table(
    [3000, 6200],
    ['功能', '说明'],
    [
      ['创建账号时指定分组', '创建医院/加工厂账号时选客户分组，创建设计师账号时选设计师分组；各有「+ 快速创建分组」按钮'],
      ['未分组提醒', '未选分组时显示黄色警告文字，软提示不硬阻断'],
      ['分组匹配 Tab', '矩阵表格 UI：行为客户组、列为设计师组，勾选即建立匹配关系；每列显示该组人数和备注；无匹配时行背景标红'],
      ['客户组管理', '支持新建、编辑（名称+备注）、删除（有成员时不可删）'],
      ['未分配订单调度', '订单总览中 unassigned 订单可点击「重新派发」按钮重置为 pending 状态'],
      ['设计师组备注编辑', '分组管理页面支持直接编辑各组备注'],
    ],
  ),
  h2('12.3 订单路由规则'),
  table(
    [3000, 6200],
    ['场景', '行为'],
    [
      ['客户下单', '订单进入该客户组匹配到的设计师组的接单池'],
      ['客户组无匹配设计师组', '订单自动变为 unassigned，生成管理端提醒'],
      ['设计师无匹配客户组', '接单大厅为空，避免误接'],
      ['设计师/客户调组', '已接单中的订单不受影响，新订单按最新规则'],
      ['返工订单', '保留原设计师，不重新匹配'],
    ],
  ),
);


const doc = new Document({
  features: { updateFields: true },
  sections: [
    {
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      headers: {
        default: new Header({
          children: [para(run(docTitle, { bold: true, color: palette.primary }), { alignment: AlignmentType.CENTER })],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            para(new TextRun({ children: [PageNumber.CURRENT], font, size: 20 }), {
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
      },
      children,
    },
  ],
});

fs.writeFileSync(outputPath, await Packer.toBuffer(doc));

