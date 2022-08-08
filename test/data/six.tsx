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

// export function cycle(value: number) {
//   return render(value);
// }

export function main() {
  console.log('render(17):', render(17));
  return 0;
}
