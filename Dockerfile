# prepare the base image that will be used in final product
FROM debian:buster-slim as base

ENV TZ=UTC
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

ENV APP_PORT=39900

WORKDIR /tmp
RUN apt-get update
RUN apt-get install -y ghostscript

# compile application in a workspace
FROM golang:1.16 as workspace

WORKDIR /go/src/app
COPY . .

RUN make deps
RUN make

# prepare finished image by combining base image and assets from workspace
FROM base as release
COPY --from=workspace /go/src/app/bin/sign-this-doc /usr/bin/sign-this-doc
RUN chmod +x /usr/bin/sign-this-doc

ENTRYPOINT ["/usr/bin/sign-this-doc"]
