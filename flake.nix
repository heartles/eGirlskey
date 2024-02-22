{
  description = "misskey dev";
  #inputs = { nixpkgs.url = "github:NixOS/nixpkgs/release-23.05"; };
  inputs = { nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable"; };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [ (final: prev: { nodejs = prev.nodejs_20; }) ];
        };
        #nixpkgs.legacyPackages.${system};
      in { devShells.default = import ./shell.nix { inherit pkgs; }; });
}
