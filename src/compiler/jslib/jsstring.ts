import { Instr } from "../instr";
import { Globals } from "../instr/globals";
import { GlobalVar } from "../instr/globalvar";
import { JsString } from "../types/jsstring";

export interface JsStringLib {
  globalConstVar: (s: string) => GlobalVar<JsString>;
}

export function jsStringFactory(instr: Instr): JsStringLib {
  const { types } = instr;
  const { jsString } = types;
  const globalConstVars = new Globals<GlobalVar<JsString>, [string]>(
    (name, value) => {
      const len = value.length;
      const ptr = instr.globalStringPtr(value);
      const jss = jsString.constString(len, ptr);
      return instr.globalConstVar(`jss.${name}`, jss);
    }
  );
  return {
    globalConstVar(s: string): GlobalVar<JsString> {
      return globalConstVars.get(s, s);
    },
  };
}
