package environment

import "os"

const (
	tenantNameEnvVar                 string = "TENANT_NAME"
	haproxyManageEndpointsPortEnvVar string = "HAPROXY_MANAGE_ENDPOINTS_PORT"
	haproxyHealthcheckPortEnvVar     string = "LUNAR_HEALTHCHECK_PORT"
)

func GetTenantName() string {
	return os.Getenv(tenantNameEnvVar)
}

func GetManageEndpointsPort() string {
	return os.Getenv(haproxyManageEndpointsPortEnvVar)
}

func GetHAProxyHealthcheckPort() string {
	return os.Getenv(haproxyHealthcheckPortEnvVar)
}
