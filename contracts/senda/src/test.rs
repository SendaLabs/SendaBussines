#![cfg(test)]

use super::*;
use soroban_sdk::{vec, Env, String};

#[test]
fn hello_returns_greeting() {
    let env = Env::default();
    let contract_id = env.register(SendaContract, ());
    let client = SendaContractClient::new(&env, &contract_id);

    let words = client.hello(&String::from_str(&env, "Senda"));
    assert_eq!(
        words,
        vec![
            &env,
            String::from_str(&env, "Hello"),
            String::from_str(&env, "Senda"),
        ]
    );
}
