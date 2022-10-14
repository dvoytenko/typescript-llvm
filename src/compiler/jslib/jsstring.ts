/*
Copyright 2022 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

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
