import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csv", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralises spreadsheet formulas in text but leaves numbers alone", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("-cmd")).toBe("'-cmd");
    expect(csvCell("@sum")).toBe("'@sum");
    expect(csvCell(-16.41)).toBe("-16.41");
  });

  it("writes empty cells for null and undefined, and CRLF rows", () => {
    expect(toCsv(["a", "b"], [["x", null], [1, undefined]])).toBe("a,b\r\nx,\r\n1,\r\n");
  });
});
