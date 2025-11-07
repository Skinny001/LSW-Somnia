# Last Staker Win - Smart Contract Makefile

# Include environment variables
include .env
export

# Default target
.PHONY: help
help:
	@echo "Last Staker Win Smart Contract Commands"
	@echo ""
	@echo "Building and Testing:"
	@echo "  make build        - Compile contracts"
	@echo "  make test         - Run all tests"
	@echo "  make test-unit    - Run unit tests only"
	@echo "  make test-integration - Run integration tests only"
	@echo "  make coverage     - Generate test coverage report"
	@echo "  make clean        - Clean build artifacts"
	@echo ""
	@echo "Deployment:"
	@echo "  make deploy-mumbai     - Deploy to Polygon Mumbai testnet"
	@echo "  make deploy-polygon    - Deploy to Polygon mainnet"
	@echo "  make deploy-sepolia    - Deploy to Ethereum Sepolia testnet"
	@echo "  make deploy-ethereum   - Deploy to Ethereum mainnet"
	@echo "  make deploy-local      - Deploy locally with mock VRF"
	@echo ""
	@echo "Local Development:"
	@echo "  make anvil        - Start local Anvil node"
	@echo "  make format       - Format Solidity code"

# Building and testing
.PHONY: build
build:
	forge build

.PHONY: test
test:
	forge test

.PHONY: test-unit
test-unit:
	forge test --match-contract "LSWTest|RewarderTest"

.PHONY: test-integration
test-integration:
	forge test --match-contract IntegrationTest

.PHONY: coverage
coverage:
	forge coverage

.PHONY: clean
clean:
	forge clean

# Deployment commands
.PHONY: deploy-mumbai
deploy-mumbai:
	@echo "Deploying to Polygon Mumbai testnet..."
	forge script script/LSW.s.sol:LSWScript --rpc-url $(POLYGON_MUMBAI_RPC) --broadcast --verify --etherscan-api-key $(POLYGONSCAN_API_KEY) -vvvv

.PHONY: deploy-polygon
deploy-polygon:
	@echo "Deploying to Polygon mainnet..."
	@echo "WARNING: This will deploy to MAINNET with real funds!"
	@read -p "Are you sure? (y/N): " confirm && [ "$$confirm" = "y" ]
	forge script script/LSW.s.sol:LSWScript --rpc-url $(POLYGON_MAINNET_RPC) --broadcast --verify --etherscan-api-key $(POLYGONSCAN_API_KEY) -vvvv

.PHONY: deploy-sepolia
deploy-sepolia:
	@echo "Deploying to Ethereum Sepolia testnet..."
	forge script script/LSW.s.sol:LSWScript --rpc-url $(ETHEREUM_SEPOLIA_RPC) --broadcast --verify --etherscan-api-key $(ETHERSCAN_API_KEY) -vvvv

.PHONY: deploy-ethereum
deploy-ethereum:
	@echo "Deploying to Ethereum mainnet..."
	@echo "WARNING: This will deploy to MAINNET with real funds!"
	@read -p "Are you sure? (y/N): " confirm && [ "$$confirm" = "y" ]
	forge script script/LSW.s.sol:LSWScript --rpc-url $(ETHEREUM_MAINNET_RPC) --broadcast --verify --etherscan-api-key $(ETHERSCAN_API_KEY) -vvvv

.PHONY: deploy-local
deploy-local:
	@echo "Deploying locally with mock VRF..."
	forge script script/LSW.s.sol:LSWScript --rpc-url http://localhost:8545 --broadcast --sig "deployWithMockVRF()" -vvvv

# Local development
.PHONY: anvil
anvil:
	anvil

.PHONY: format
format:
	forge fmt

# Gas optimization
.PHONY: gas-report
gas-report:
	forge test --gas-report

.PHONY: snapshot
snapshot:
	forge snapshot
