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

import {jsx, ComponentType} from './lib-jsx';

export function render(v: number) {
  return (
    <div label={v}>
      hello
      {/* <Text>hi world!</Text> */}
      {/* <Hr/> */}
    </div>
  );
}

// const Text: ComponentType = ({children}) => {
//   return <span>{children}</span>;
// };

// function Hr() {
//   return <hr/>
// }

export function cycle(value: number) {
  return render(value);
}

export function main() {
  console.log('render(17):', render(17));
  return 0;
}
