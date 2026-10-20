/** Equations keep mathematical order inside RTL prose. These are authored
 * examples, not interpreted executable markup or equations from user notes. */
const expressions=/((?:\d+(?:[.,]\d+)?[a-z]?|[a-z])(?:\s*[×÷+=]\s*(?:\d+(?:[.,]\d+)?[a-z]?|[a-z]))+)/g
export function TeachingText({text}:{text:string}):React.JSX.Element {
  return <>{text.split(expressions).map((part,i)=>i%2?<bdi dir="ltr" key={i}>{part}</bdi>:part)}</>
}
