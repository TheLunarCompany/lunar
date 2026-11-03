output "eks_vpc" {
  description = "The EKS VPC id."
  value       = data.aws_eks_cluster.existing_eks.vpc_config[0].vpc_id
}

output "eks_arn" {
  description = "The EKS VPC ARN."
  value       = data.aws_eks_cluster.existing_eks.arn
}

output "public_subnet_ids" {
    description = "The EKS public Subnet IDs."
    value = data.aws_subnets.public_subnets.ids
}

output "inbound_security_group_id" {
    description = "The Security group ID. for all inbound traffic from WWW to the NLB"
    value = aws_security_group.allow_lunar_proxy.id
}

output "service_internal_ips" {
  value = trimspace(data.local_file.endpoint_ip_tmp.content)
}

output "nlb_dns_name" {
    description = "The NLB DNS name."
    value = aws_lb.network_load_balancer.dns_name
}

output "uri_lunar_proxy_service"  {
    description = "The URI for the lunar proxy service"
    value = "http://${aws_lb.network_load_balancer.dns_name}:8000/"
}

output "uri_lunar_proxy_service_health_check"  {
    description = "The URI for the lunar proxy service health check"
    value = "http://${aws_lb.network_load_balancer.dns_name}:8040/healthcheck"
}

output "uri_lunar_proxy_service_administration"  {
    description = "The URI for the lunar proxy service administration"
    value = "http://${aws_lb.network_load_balancer.dns_name}:8081/discover"
}

output "validated_healthcheck_result"  {
    description = "The Result of the healthcheck http request"
    value = data.http.validate_health_check.response_body
}
