import { v4 as uuidv4 } from "uuid";

export interface DockerArguments {
  originalImage: string;
  args: string[];
  image: string;
}

export function generateDockerFile(
  osType: "alpine" | "debian" | "ubuntu" | "centos" | "rhel" | "fedora",
): (props: {
  originalImageName: string;
  caCertFilename: string;
  originalUser: string;
}) => string {
  switch (osType) {
    case "alpine":
      return ({ originalImageName, caCertFilename, originalUser }) => `
FROM ${originalImageName}
USER root
COPY ${caCertFilename} /usr/local/share/ca-certificates/proxy_lunar.crt
RUN apk add --no-cache ca-certificates
ENV SSL_CERT_FILE=/usr/local/share/ca-certificates/proxy_lunar.crt
ENV GODEBUG=http2client=0
RUN update-ca-certificates || true
USER ${originalUser}
`;
    case "debian":
    case "ubuntu":
      return ({ originalImageName, caCertFilename, originalUser }) => `
FROM ${originalImageName}
USER root
COPY ${caCertFilename} /usr/local/share/ca-certificates/proxy_lunar.crt
RUN apt-get update && apt-get install -y ca-certificates
ENV SSL_CERT_FILE=/usr/local/share/ca-certificates/proxy_lunar.crt
ENV GODEBUG=http2client=0
RUN update-ca-certificates || true
USER ${originalUser}
`;
    case "centos":
    case "rhel":
    case "fedora":
      return ({ originalImageName, caCertFilename, originalUser }) => `
FROM ${originalImageName}
USER root
COPY ${caCertFilename} /etc/pki/ca-trust/source/anchors/proxy_lunar.crt
RUN yum install -y ca-certificates || dnf install -y ca-certificates
ENV SSL_CERT_FILE=/etc/pki/ca-trust/source/anchors/proxy_lunar.crt
ENV GODEBUG=http2client=0
RUN update-ca-trust extract || true
USER ${originalUser}
`;
    default:
      throw new Error(`Unsupported OS type: ${osType}`);
  }
}

export function parseDockerArgs(args: string[]): DockerArguments {
  const argsCopy = [...args];
  const uuid = uuidv4().replace(/-/g, "");
  const originalImage = argsCopy.pop() || "";
  const modifiedArgs = argsCopy.filter(
    (arg) => !arg.startsWith("--network=") && !arg.startsWith("--net="),
  );
  const newImageTag = `${originalImage.split(":")[0]}-with-lunar.dev-interception-${uuid.slice(-5)}`;

  modifiedArgs.push(...["--network", "host"]);
  modifiedArgs.push(newImageTag);

  return {
    originalImage,
    args: modifiedArgs,
    image: newImageTag,
  };
}
