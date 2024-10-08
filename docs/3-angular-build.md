# Recovery Application

Refer to **package.json** for Angular's project generation details.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Launch with afb-binder

On the target which contains the recovery web application, you can launch the app:

```sh
/usr/bin/afb-binder \
--name=recovery-app \
--workdir=/usr/redpesk/recovery/ \
--port=8080 \
--roothttp=./webapp/ \
--binding=/usr/redpesk/spawn-binding/lib/spawn-binding.so:/usr/redpesk/recovery/conf/spawn-recovery-config.json -vvv
```

## Build the tarball

To build the recovery archive, you can run the following commands:

- install dependencies

```
npm install
```

- build the app (production mode)

```
npm run build:prod
```

- (optional) build the app (development mode with debug files)

```
npm run build:dev
```

## Further help

To get more help on the Angular CLI use `ng help` or check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.


