import paramiko
import os

pub_key_path = os.path.expanduser("~/.ssh/id_ed25519.pub")
with open(pub_key_path, "r") as f:
    pub_key = f.read().strip()

ips = ["178.105.250.222", "2.29.17.123"]
pwd = "3sXaLxfaArhp"

for ip in ips:
    try:
        print(f"Connecting to {ip}...")
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(ip, username="root", password=pwd, timeout=8)
        print(f"SUCCESS! Logged into {ip}")
        
        # Install public key
        cmd = f'mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo "{pub_key}" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && sort -u ~/.ssh/authorized_keys -o ~/.ssh/authorized_keys'
        stdin, stdout, stderr = ssh.exec_command(cmd)
        stdout.channel.recv_exit_status()
        print("Installed SSH public key into /root/.ssh/authorized_keys")
        
        stdin, stdout, stderr = ssh.exec_command("cat /etc/os-release | grep PRETTY_NAME && uname -a && uptime && df -h /")
        print(stdout.read().decode())
        ssh.close()
        break
    except Exception as e:
        print(f"Failed {ip}: {e}")
