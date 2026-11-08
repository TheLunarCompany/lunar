# Deploy

Use Terraform to setup Lunar.dev Proxy on your EKS.
it takes about 3 min to deploy the nlb and the service.  
service is available at the output URI about 1 min after the terra-forming is finished and a healthcheck ready state is achieved.

1. init the directory: 
```bash
terraform init
```

2. plan the deployment:

some Variables Values are Deployment Specific and must be Supplied at plan, apply & remove time.  
you can supply them in the command dialog. or as the command input variables.

you must provide:
 -  `input_eks_name` - a cluster Name
 -  `input_tenant_name` - tenant Name

your eks nodes should allow inbound traffic from the created nlb on hte eks public subnets. ports 8000, 8040 and 8081 should have an allow rule. if you do not have such a rule. specifying the security group of your eks nodes (`security_group_nlb_2_nodes`) is needed to add the rule by the terraform.

some Variables Values are Deployment Specific but have a commonly used default, these can be over-ridden in the command input variables. or in the `variables.tf` file default value.

you can modify:
 - `aws_profile_name` -  **defaults to "default"** - add this value to use a specific aws profile. you can see the local profile names at `~/.aws/config`
 - `helm_chart_repository` - **defaults to ""** - change this if you want to use a private repository, with a different path 
 - `helm_chart_name` - **defaults to "lunar-proxy"** - change this if you want to use a private chart, with a different name 
 - `helm_chart_version` - **defaults to "latest"** - change this if you want to use a specific version.  
    `helm_release` will not automatically grab the latest release, version must explicitly upgraded when upgrading an installed chart. 
 - `lunar_api_key` - **defaults to ""** - The Lunar API key to integrate with the [Control Plane](https://app.lunar.dev).
 - `lunar_api_key_secret_name` - **defaults to ""** - The name of the secret, which will contain the Lunar API key to integrate with the [Control Plane](https://app.lunar.dev).
 The value of the API key must be in the given secret under the key `lunarAPIKey`
 - `security_group_nlb_2_nodes` - **defaults to "skip"** - add this in case there is no rule allowing from the nlb subnets to the nodes TCP on ports 8000, 8040 & 8081, if this value is not provided, then setting the rules will be skipped.


```bash
terraform plan -input=true -var 'input_tenant_name=exampleTenant'
```

3. apply the changes:
```bash
terraform apply -input=true
```

 - to get the output traces:
`terraform output`

 - to clean and remove the resources.
 ```bahe
 terraform destroy -input=true
 ```

## Production hardening

The module defaults are tuned for a frictionless **evaluation** install (open egress, public NLB, no deletion protection). For production use you should override the following variables.

> Behavior changes between releases — both for this Terraform module and the companion Helm chart at `../k8s/helm-charts/` — are recorded in [`../CHANGELOG.md`](../CHANGELOG.md).

| Variable | Default | Production value | Why |
|---|---|---|---|
| `allowed_egress_cidrs` | `["0.0.0.0/0"]` | The list of CIDRs your proxy actually needs to reach (upstream APIs, control plane, etc.) | The default lets the proxy egress to the entire internet. Restricting this limits the blast radius if the proxy is compromised — a leaked credential cannot exfiltrate to an attacker-controlled host outside the allow-list. |
| `allowed_egress_ipv6_cidrs` | `["::/0"]` | `[]` if you don't use IPv6 upstreams, otherwise the IPv6 equivalent of your allow-list | Same reasoning as ipv4. Set to `[]` to disable IPv6 egress entirely. |
| `load_balancer_internal` | `false` (public NLB) | `true` if you can put the proxy behind your own ingress / VPN | A public NLB exposes the proxy directly to the internet. If your applications calling the proxy already live in the same VPC (or are reachable via VPN), a private NLB removes the public attack surface entirely. |
| `enable_deletion_protection` | `true` | `true` (keep default in production) | Default flipped from the old hard-coded `false`. Prevents `terraform destroy` from accidentally wiping out a load-balancer that downstream DNS / clients depend on. Set to `false` only in throwaway evaluation environments. |
| `access_logs_bucket` | `""` (disabled) | An S3 bucket you control, with the [AWS-required policy](https://docs.aws.amazon.com/elasticloadbalancing/latest/network/load-balancer-access-logs.html#access-logging-bucket-permissions) | NLB access logs are the only record you have of who connected when. Required for incident response and most compliance regimes (SOC 2, PCI DSS, HIPAA). |
| `access_logs_prefix` | `"lunar-proxy-nlb"` | Anything that fits your bucket's key layout | Optional; ignored unless `access_logs_bucket` is set. |

Example production overrides via `terraform.tfvars`:

```hcl
allowed_egress_cidrs       = ["10.0.0.0/8", "203.0.113.42/32"]  # your VPC + upstream API
allowed_egress_ipv6_cidrs  = []
load_balancer_internal     = true
enable_deletion_protection = true
access_logs_bucket         = "my-org-nlb-access-logs"
access_logs_prefix         = "lunar-proxy"
```

> **Note:** `drop_invalid_header_fields` is sometimes flagged on this resource by generic security scanners. That attribute is **Application Load Balancer-only** in the AWS provider; there is no equivalent on Network Load Balancers because NLBs operate at layer 4 and do not parse HTTP headers. The finding is a false positive for this module.

## Provisions:

 - the proxy deployment using the specific release helm chart
 - set the NLB in front of the proxy.
 - the security groups needed to allow network traffic. allow ports 8000,8081,8040 inbound and all outbound


## refrences:

 - [Helm Provider](https://registry.terraform.io/providers/hashicorp/helm/latest/docs)
 - [Resource: aws_security_group](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/security_group)