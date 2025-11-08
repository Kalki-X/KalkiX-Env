<?php
$servername = "mysql";
$username = "dev";
$password = "dev123";
$database = "devdb";

$conn = new mysqli($servername, $username, $password, $database);

if ($conn->connect_error) {
  die("❌ Connection failed: " . $conn->connect_error);
}

echo "✅ PHP connected to MySQL successfully!";

echo phpinfo();
?>
