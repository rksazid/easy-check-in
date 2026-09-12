import { describe, expect, it } from "vitest";

import { csvCell, csvDocument, csvRow } from "./csv";

describe("csvCell", () => {
  it("quotes plain text", () => {
    expect(csvCell("Ada Lovelace")).toBe('"Ada Lovelace"');
  });

  it("doubles embedded quotes", () => {
    expect(csvCell('She said "hi"')).toBe('"She said ""hi"""');
  });

  it("keeps commas and newlines inside the field", () => {
    expect(csvCell("London, England")).toBe('"London, England"');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("renders empty for null and undefined", () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });

  it("keeps numbers intact", () => {
    expect(csvCell(4.5)).toBe('"4.5"');
    expect(csvCell(0)).toBe('"0"');
  });

  it("neutralises a formula so a spreadsheet will not run it", () => {
    expect(csvCell('=HYPERLINK("http://evil","click")')).toBe(
      '"\'=HYPERLINK(""http://evil"",""click"")"',
    );
    expect(csvCell("+1+1")).toBe("\"'+1+1\"");
    expect(csvCell("-2+3")).toBe("\"'-2+3\"");
    expect(csvCell("@SUM(A1)")).toBe("\"'@SUM(A1)\"");
  });

  it("leaves an ordinary negative number readable", () => {
    // Still prefixed, because a leading "-" is indistinguishable from a formula.
    expect(csvCell(-5)).toBe("\"'-5\"");
  });
});

describe("csvRow", () => {
  it("joins fields with commas", () => {
    expect(csvRow(["a", 1, null])).toBe('"a","1",""');
  });
});

describe("csvDocument", () => {
  it("adds a BOM and CRLF endings", () => {
    expect(csvDocument(['"a"', '"b"'])).toBe('﻿"a"\r\n"b"\r\n');
  });
});
