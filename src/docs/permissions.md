# How permissions parameter works

```ts
type Permissons = string | string[] | (string[] | string)[]
```
## Examples

### 1. Simple
```ts
permissions: "get"  // ---> if(get) runHandler()
```
The "get" permission is required.

### 2. Array
```ts
permissions: ["get", "post"]  // ---> if(get && post) runHandler()
```
The "get" and "post" permissions are required. 

### 3. Nested array
```ts
permissions: [["update"]]  // ---> if(true) runHandler()  
```
The "update" permission adds some functionality to the handler, but it's not required. \
<span style="color: orange">Warning!</span> Not recommended, it's bad idea to let <u>anyone</u> use you api.

### 4. Combination
```ts
permissions: ["get", "post", ["update"]]  // ---> if(get && post) runHandler()  
```
The "get" and "post" permissions are required, but "update" is optional. The "update" permission can for example add some functionality to the handler. Try to avoid useless permissions to maintain clean code. 

