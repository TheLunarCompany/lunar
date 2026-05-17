provider aws {
  profile = var.aws_profile_name
}

data "aws_eks_cluster" "existing_eks" {
  name = var.input_eks_name
}

provider "helm" {
  kubernetes {
    config_path = "~/.kube/config"
    config_context = data.aws_eks_cluster.existing_eks.arn
  }
}

resource "helm_release" "lunar-proxy" {
  name = "lunar-proxy"

  # defaults to "https://thelunarcompany.github.io/proxy-helm-chart"
  repository = var.helm_chart_repository
  # defaults to "lunar-proxy"
  chart = var.helm_chart_name

  version = var.helm_chart_version != "latest" ? var.helm_chart_version : null
  create_namespace = var.lunar_k8s_namespace != "default" ? true : null
  namespace        = var.lunar_k8s_namespace != "default" ? var.lunar_k8s_namespace : null

  force_update = true
  replace = true

  set {
    name  = "tenantName"
    value = var.input_tenant_name
  }
  set {
    name  = "service.type"
    value = "ClusterIP"
    
  }
  set_sensitive {
    name  = "lunarAPIKey"
    value = var.lunar_api_key
  }
  set {
    name  = "lunarAPIKeySecretName"
    value = var.lunar_api_key_secret_name
  }
}

# the VPC id will be fetched from the EKS
data "aws_vpc" "existing_vpc" {
  id = data.aws_eks_cluster.existing_eks.vpc_config[0].vpc_id
}

# Security Group to allow inbound traffic from WWW to NLB
resource "aws_security_group" "allow_lunar_proxy" {
  name        = "allow-lunar-proxy"
  description = "Allow Lunar.dev Proxy inbound traffic and all outbound traffic"
  vpc_id      = data.aws_vpc.existing_vpc.id

  egress {
    from_port        = 0
    to_port          = 0
    protocol         = "-1"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }

  tags = {
    Name = "allow-lunar-proxy"
  }
}

# Security Group Rules to allow inbound traffic from WWW to NLB
resource "aws_vpc_security_group_ingress_rule" "allow_lunar_8000_ipv4" {
  security_group_id = aws_security_group.allow_lunar_proxy.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 8000
  ip_protocol       = "tcp"
  to_port           = 8000
}

# Security Group Rules to allow inbound traffic from WWW to NLB
resource "aws_vpc_security_group_ingress_rule" "allow_lunar_8000_ipv6" {
  count             = data.aws_vpc.existing_vpc.ipv6_cidr_block != null && length(data.aws_vpc.existing_vpc.ipv6_cidr_block) > 0 ? 1 : 0
  security_group_id = aws_security_group.allow_lunar_proxy.id
  cidr_ipv6         = "::/0"
  from_port         = 8000
  ip_protocol       = "tcp"
  to_port           = 8000
}


# Security Group Rules to allow inbound traffic from WWW to NLB
resource "aws_vpc_security_group_ingress_rule" "allow_lunar_8081_ipv4" {
  security_group_id = aws_security_group.allow_lunar_proxy.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 8081
  ip_protocol       = "tcp"
  to_port           = 8081
}

# Security Group Rules to allow inbound traffic from WWW to NLB
resource "aws_vpc_security_group_ingress_rule" "allow_lunar_8081_ipv6" {
  count             = data.aws_vpc.existing_vpc.ipv6_cidr_block != null && length(data.aws_vpc.existing_vpc.ipv6_cidr_block) > 0 ? 1 : 0
  security_group_id = aws_security_group.allow_lunar_proxy.id
  cidr_ipv6         = "::/0"
  from_port         = 8081
  ip_protocol       = "tcp"
  to_port           = 8081
}

# Security Group Rules to allow inbound traffic from WWW to NLB
resource "aws_vpc_security_group_ingress_rule" "allow_lunar_8040_ipv4" {
  security_group_id = aws_security_group.allow_lunar_proxy.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 8040
  ip_protocol       = "tcp"
  to_port           = 8040
}

# Security Group Rules to allow inbound traffic from WWW to NLB
resource "aws_vpc_security_group_ingress_rule" "allow_lunar_8040_ipv6" {
  count             = data.aws_vpc.existing_vpc.ipv6_cidr_block != null && length(data.aws_vpc.existing_vpc.ipv6_cidr_block) > 0 ? 1 : 0
  security_group_id = aws_security_group.allow_lunar_proxy.id
  cidr_ipv6         = "::/0"
  from_port         = 8040
  ip_protocol       = "tcp"
  to_port           = 8040
}


# Security Group Rules to allow inbound traffic from NLB to EKS instance
resource "aws_security_group_rule" "allow_lunar_8000_nlb2node" {
  count             = var.security_group_nlb_2_nodes != "skip" ? 1 : 0
  type              = "ingress"
  description       = "Security Group Rules to allow inbound traffic from NLB to EKS instance"
  from_port         = 8000
  to_port           = 8000
  protocol          = "tcp"
  security_group_id = var.security_group_nlb_2_nodes
  cidr_blocks       = [data.aws_vpc.existing_vpc.cidr_block]
}

# Security Group Rules to allow inbound traffic from NLB to EKS instance
resource "aws_security_group_rule" "allow_lunar_8040_nlb2node" {
  count             = var.security_group_nlb_2_nodes != "skip" ? 1 : 0
  type              = "ingress"
  description       = "Security Group Rules to allow inbound traffic from NLB to EKS instance"
  from_port         = 8040
  to_port           = 8040
  protocol          = "tcp"
  security_group_id = var.security_group_nlb_2_nodes
  cidr_blocks       = [data.aws_vpc.existing_vpc.cidr_block]
}

# Security Group Rules to allow inbound traffic from NLB to EKS instance
resource "aws_security_group_rule" "allow_lunar_8081_nlb2node" {
  count             = var.security_group_nlb_2_nodes != "skip" ? 1 : 0
  type              = "ingress"
  description       = "Security Group Rules to allow inbound traffic from NLB to EKS instance"
  from_port         = 8081
  to_port           = 8081
  protocol          = "tcp"
  security_group_id = var.security_group_nlb_2_nodes
  cidr_blocks       = [data.aws_vpc.existing_vpc.cidr_block]
}

data "aws_subnets" "public_subnets" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.existing_vpc.id]
  }
  filter {
    name   = "map-public-ip-on-launch"
    values = ["true"]
  }
}

resource "aws_lb" "network_load_balancer" {
  name               = "lunar-proxy-network-loadbalancer"
  internal           = false
  load_balancer_type = "network"
  security_groups    = [aws_security_group.allow_lunar_proxy.id]
  subnets = data.aws_subnets.public_subnets.ids  

  enable_deletion_protection = false # If true, deletion of the load balancer will be disabled via the AWS API. This will prevent Terraform from deleting the load balancer

  tags = {
    Name        = "lunar-proxy-network-loadbalancer"
    Environment = "production"
  }
}

resource "aws_lb_target_group" "lunar_target_group_8000" {
  name     = "lunar-target-group-8000"
  port     = 8000
  protocol = "TCP"
  target_type = "ip"
  vpc_id   = data.aws_vpc.existing_vpc.id

  health_check {
    port                = 8040
    protocol            = "HTTP"
    path                = "/healthcheck"
    interval            = 10
    timeout             = 2
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }

  tags = {
    Name = "lunar-target-group-8000"
  }
}

resource "aws_lb_target_group" "lunar_target_group_8081" {
  name     = "lunar-target-group-8081"
  port     = 8081
  protocol = "TCP"
  target_type = "ip"
  vpc_id   = data.aws_vpc.existing_vpc.id

  health_check {
    port                = 8040
    protocol            = "HTTP"
    path                = "/healthcheck"
    interval            = 10
    timeout             = 2
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }

  tags = {
    Name = "lunar-target-group-8081"
  }
}

resource "aws_lb_target_group" "lunar_target_group_8040" {
  name     = "lunar-target-group-8040"
  port     = 8040
  protocol = "TCP"
  target_type = "ip"
  vpc_id   = data.aws_vpc.existing_vpc.id

  health_check {
    port                = 8040
    protocol            = "HTTP"
    path                = "/healthcheck"
    interval            = 10
    timeout             = 2
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }

  tags = {
    Name = "lunar-target-group-8040"
  }
}

resource "aws_lb_listener" "lunar_listener_8000" {
  load_balancer_arn = aws_lb.network_load_balancer.arn
  port              = 8000
  protocol          = "TCP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.lunar_target_group_8000.arn
  }
}

resource "aws_lb_listener" "lunar_listener_8081" {
  load_balancer_arn = aws_lb.network_load_balancer.arn
  port              = 8081
  protocol          = "TCP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.lunar_target_group_8081.arn
  }
}

resource "aws_lb_listener" "example_8040" {
  load_balancer_arn = aws_lb.network_load_balancer.arn
  port              = 8040
  protocol          = "TCP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.lunar_target_group_8040.arn
  }
}

provider kubernetes {
  config_path = "~/.kube/config"
  config_context = data.aws_eks_cluster.existing_eks.arn
}

# Pull Service info to ensure ut exxists before, Add / update the target-group annotations to the service.
resource "null_resource" "service_info" {
  triggers = {
    always_run = "${timestamp()}"
  }

  provisioner "local-exec" {
    command = "kubectl get svc/lunar-proxy --context ${data.aws_eks_cluster.existing_eks.arn}"
    environment = {
      KUBECONFIG = pathexpand("~/.kube/config")  # Specify the path to your kubeconfig file
    }
  }

  depends_on = [helm_release.lunar-proxy, data.aws_eks_cluster.existing_eks]
}

# This will pull the current stage annotation list so can be outputed.
resource "null_resource" "service_annotation" {
  triggers = {
    always_run = "${timestamp()}"
  }

  provisioner "local-exec" {
    command = "kubectl annotate svc/lunar-proxy -n default --list --context ${data.aws_eks_cluster.existing_eks.arn}"
    environment = {
      KUBECONFIG = pathexpand("~/.kube/config")  # Specify the path to your kubeconfig file
    }
  }

  depends_on = [null_resource.service_info, data.aws_eks_cluster.existing_eks]
}

resource "null_resource" "get_service_endpoints" {
  triggers = {
    always_run = "${timestamp()}"
  }
  provisioner "local-exec" {
    command = <<EOF
      kubectl get endpoints lunar-proxy -n default -o json | jq -r '.subsets[].addresses[].ip' > endpoint_ip.tmp
    EOF

    interpreter = ["bash", "-c"]
  }
  depends_on = [ null_resource.service_info, null_resource.service_annotation, data.aws_eks_cluster.existing_eks ]
}

data "local_file" "endpoint_ip_tmp" {
  filename = "${path.module}/endpoint_ip.tmp"
  depends_on = [ null_resource.get_service_endpoints ]
}

# Register EKS nodes as targets in the Target Group
resource "aws_lb_target_group_attachment" "target_8000" {
  target_group_arn = aws_lb_target_group.lunar_target_group_8000.arn
  target_id        = trimspace(data.local_file.endpoint_ip_tmp.content)
  # availability_zone = "all"
  port             = 8000
  depends_on = [ null_resource.get_service_endpoints, aws_lb_target_group.lunar_target_group_8081 ]
}

# Register EKS nodes as targets in the Target Group
resource "aws_lb_target_group_attachment" "target_8040" {
  target_group_arn = aws_lb_target_group.lunar_target_group_8040.arn
  target_id        = trimspace(data.local_file.endpoint_ip_tmp.content)
  # availability_zone = "all"
  port             = 8040
  depends_on = [ null_resource.get_service_endpoints, aws_lb_target_group.lunar_target_group_8081 ]
}

# Register EKS nodes as targets in the Target Group
resource "aws_lb_target_group_attachment" "target_8081" {
  target_group_arn = aws_lb_target_group.lunar_target_group_8081.arn
  target_id        = trimspace(data.local_file.endpoint_ip_tmp.content)
  # availability_zone = "all"
  port             = 8081
  depends_on = [ null_resource.get_service_endpoints, aws_lb_target_group.lunar_target_group_8081 ]
}

data "http" "validate_health_check" {
  url = "http://${aws_lb.network_load_balancer.dns_name}:8040/healthcheck"
  depends_on = [ aws_lb.network_load_balancer ]

  retry {
    attempts = 12
    max_delay_ms = 30000
    min_delay_ms = 30000
  }
}
