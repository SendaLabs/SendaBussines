#![no_std]
use soroban_sdk::{contract, contractimpl, vec, Env, String, Vec};

/// Contrato base de Senda Business.
/// Reemplazá esta lógica por el dominio de negocio (registry, pagos, etc.).
#[contract]
pub struct SendaContract;

#[contractimpl]
impl SendaContract {
    /// Saludo de ejemplo para validar build, tests y bindings.
    pub fn hello(env: Env, to: String) -> Vec<String> {
        vec![&env, String::from_str(&env, "Hello"), to]
    }
}

mod test;
