import { Box, Flex, Image, Button ,Text} from "@chakra-ui/react";

import logo from "../../../assets/logoplaceholder.png";

export default function Navbar() {
    return (
        <Box
            as="nav"
            display="flex"
            justifyContent="space-between"
            bg="#2b2b2b"
            px="10"
            height="150px"
            position="sticky"
            top="0"
            zIndex="1000"
        >
            {/* Logo/Label */}
            <Flex
                alignItems="center"
                gap="50px" 
            >
                <Image
                    src={logo}
                    alt="placeholder"
                    boxSize="150px"
                ></Image>
                
            </Flex>
            <Text width = "1500px" height = "300px" align = "center" marginTop = "60px"
            fontSize = {40} fontStyle = "bold" fontWeight = "400" textColor= "#C2c2c2"
            >SpotifyRecommender</Text>

            {/* Nav Buttons */}
            <Flex
                alignItems="center"
                gap="40px"
            >
                <Button>About Us</Button>
                <Button>Contact Us</Button>
            </Flex>            
        </Box>
    );
}