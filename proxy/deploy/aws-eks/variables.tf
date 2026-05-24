# Mandatory Variables - must be supplied per env by the user:
variable "input_eks_name" {
  description = "The Existing EKS Name. Can be Fatched via `aws eks list-clusters`."
  type        = string
}

variable "input_tenant_name" {
  description = "The tenantName to set in the the helm apply."
  type        = string
}

# Optional Variables - can be user to override default values
variable "security_group_nlb_2_nodes" {
  description = "The EKS nodes security group, to add the inbound rules from the nlb. in case there is a rule allowing from the nlb subnets to the nodes TCP on ports 8000, 8040 & 8081, do not provide this value and setting the rules will be skipped."
  type        = string
  default     = "skip"
}

variable "aws_profile_name" {
  description = "The aws config to use, Defults to \"default\""
  type        = string
  default     = "default"
}

variable "helm_chart_repository" {
  description = "The repository of the helm chart to deploy."
  type        = string
  default     = "https://thelunarcompany.github.io/proxy-helm-chart"
}

variable "helm_chart_name" {
  description = "The Name of the helm chart to deploy."
  type        = string
  default     = "lunar-proxy"
}

variable "helm_chart_version" {
  description = "The version of the helm chart to deploy."
  type        = string
  default     = "latest"
}

variable "lunar_api_key" {
  description = "The API Key \"lunarAPIKey\" to use with the webapp."
  type        = string
  default     = ""
}

variable "lunar_api_key_secret_name" {
  description = "The API Key secret name \"lunarAPIKeySecretName\" to use with the webapp."
  type        = string
  default     = ""
}


variable "lunar_k8s_namespace" {
  description = "The name space that will be passed to the helm chart. so the k8s resource will be deployed to."
  type        = string
  default     = "default"
}

# --- Production hardening knobs ---------------------------------------------
# These default to backwards-compatible values so existing customers see no
# behavior change on `terraform apply`. Production deployments should override
# them per the "Production hardening" section in README.md.

variable "allowed_egress_cidrs" {
  description = "IPv4 CIDR blocks the proxy is allowed to egress to. Defaults to the open internet for backward compatibility; restrict in production to the destinations your proxy actually needs to reach."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "allowed_egress_ipv6_cidrs" {
  description = "IPv6 CIDR blocks the proxy is allowed to egress to. Defaults to the open IPv6 internet for backward compatibility; restrict in production or set to an empty list to disable IPv6 egress entirely."
  type        = list(string)
  default     = ["::/0"]
}

variable "load_balancer_internal" {
  description = "Whether the NLB is internal (private, VPC-only) or internet-facing. Defaults to false (public) because the proxy typically serves customer traffic, but a private NLB fronted by your own ingress is the recommended posture when feasible."
  type        = bool
  default     = false
}

variable "enable_deletion_protection" {
  description = "Whether AWS deletion protection is enabled on the NLB. Defaults to true so that an accidental `terraform destroy` cannot wipe out a production load balancer; set to false in throwaway / evaluation environments to allow `terraform destroy` to clean up."
  type        = bool
  default     = true
}

variable "access_logs_bucket" {
  description = "S3 bucket name to write NLB access logs to. Empty string disables access logging. Recommended in production for audit + forensics; the bucket must already exist and have a policy allowing the AWS NLB log delivery service to write to it."
  type        = string
  default     = ""
}

variable "access_logs_prefix" {
  description = "Optional S3 key prefix for NLB access logs. Ignored when access_logs_bucket is empty."
  type        = string
  default     = "lunar-proxy-nlb"
}