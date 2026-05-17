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

## Provisions:

 - the proxy deployment using the specific release helm chart
 - set the NLB in front of the proxy.
 - the security groups needed to allow network traffic. allow ports 8000,8081,8040 inbound and all outbound


## refrences:

 - [Helm Provider](https://registry.terraform.io/providers/hashicorp/helm/latest/docs)
 - [Resource: aws_security_group](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/security_group)