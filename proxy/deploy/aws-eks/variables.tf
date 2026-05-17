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